import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'; // Import useMemo
import { Play, Pause, RotateCw, RotateCcw, MapPin, MessageCircle, GripVertical, ArrowRight, Compass, Shuffle } from 'lucide-react';

// In a typical React project, an external CSS file like index.css or App.css would be imported here:
// import './index.css'; 
// Or a specific component's CSS: import './PetProgrammersApp.css';

// Helper function to find an action and its parent/path in a nested structure
const findActionAndParent = (actions, targetId, parent = null, path = []) => {
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const currentPath = [...path, i];
    if (action.id === targetId) {
      return { action, parent, path: currentPath, index: i };
    }
    if (action.children && action.children.length > 0) {
      // Changed targetId to action.id for the recursive call
      const found = findActionAndParent(action.children, targetId, action, currentPath); 
      if (found) return found;
    }
  }
  return null;
};

// Helper function to remove an action from a nested structure
const removeActionFromStructure = (actions, actionId) => {
  return actions.filter(action => {
    if (action.id === actionId) {
      return false;
    }
    if (action.children) {
      action.children = removeActionFromStructure(action.children, actionId);
    }
    return true;
  });
};

const PetProgrammersApp = () => {
  const canvasRef = useRef(null);
  
  const [isRunning, setIsRunning] = useState(false);
  const [activePets, setActivePets] = useState(['cat']); // Default to one active pet for simplicity
  const [selectedPet, setSelectedPet] = useState('cat');
  const [draggedActionId, setDraggedActionId] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null); // {path: [], index: number, type: 'sibling' | 'child'}
  const [isDraggingPet, setIsDraggingPet] = useState(false);
  const [draggedPet, setDraggedPet] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isSwapEnabled, setIsSwapEnabled] = useState(false);
  
  const [pets, setPets] = useState({
    cat: {
      x: 250, // Centered default position for single pet focus
      y: 150, // Centered default position for single pet focus
      angle: 90, // Default direction: right
      actions: [],
      executionStack: [],
      message: '',
      messageTime: 0
    },
    // Other pets remain for future multi-pet support if needed, but UI is simplified
    dog: { x: 300, y: 200, angle: 180, actions: [], executionStack: [], message: '', messageTime: 0 },
    rabbit: { x: 200, y: 150, angle: 90, actions: [], executionStack: [], message: '', messageTime: 0 },
    bird: { x: 400, y: 100, angle: 270, actions: [], executionStack: [], message: '', messageTime: 0 }
  });

  // Memoize petOptions to ensure a stable reference across renders
  const petOptions = useMemo(() => [
    { id: 'cat', name: 'Cat', emoji: '🐱', color: '#ff6b6b' },
    { id: 'dog', name: 'Dog', emoji: '🐶', color: '#4ecdc4' },
    { id: 'rabbit', name: 'Rabbit', emoji: '🐰', color: '#95e1d3' },
    { id: 'bird', name: 'Bird', emoji: '🐦', color: '#f3d250' }
  ], []); // Empty dependency array means it's created once

  // Memoize actionTypes to ensure a stable reference across renders
  const actionTypes = useMemo(() => [
    // Motion Category
    { 
      id: 'move', 
      label: 'Move', 
      icon: <ArrowRight size={16} />, 
      color: 'bg-blue-500', 
      category: 'Motion',
      inputConfig: { field: 'steps', type: 'number', defaultValue: 10 } 
    },
    { 
      id: 'turnCW', 
      label: 'Turn CW', 
      icon: <RotateCw size={16} />, 
      color: 'bg-green-500', 
      category: 'Motion',
      inputConfig: { field: 'degrees', type: 'number', defaultValue: 15 } 
    },
    { 
      id: 'turnCCW', 
      label: 'Turn CCW', 
      icon: <RotateCcw size={16} />, 
      color: 'bg-green-500',
      category: 'Motion',
      inputConfig: { field: 'degrees', type: 'number', defaultValue: -15 }
    },
    {
      id: 'pointInDirection',
      label: 'Point in direction',
      icon: <Compass size={16} />,
      color: 'bg-blue-500',
      category: 'Motion',
      inputConfig: { field: 'direction', type: 'number', defaultValue: 90 }
    },
    { 
      id: 'goToXY', 
      label: 'Go to XY', 
      icon: <MapPin size={16} />, 
      color: 'bg-purple-500', 
      category: 'Motion',
      inputConfig: [
        { field: 'x', type: 'number', defaultValue: 0 },
        { field: 'y', type: 'number', defaultValue: 0 }
      ]
    },
    {
      id: 'goToRandomPosition',
      label: 'Go to random position',
      icon: <Shuffle size={16} />,
      color: 'bg-purple-500',
      category: 'Motion',
      inputConfig: null 
    },
    // Looks Category
    { 
      id: 'say', 
      label: 'Say', 
      icon: <MessageCircle size={16} />, 
      color: 'bg-orange-500', 
      category: 'Looks',
      inputConfig: [
        { field: 'message', type: 'text', defaultValue: 'Hello!' },
        { field: 'duration', type: 'number', defaultValue: 2, min: 0.1, step: 0.1 }
      ]
    },
    { 
      id: 'think', 
      label: 'Think', 
      icon: <MessageCircle size={16} />, 
      color: 'bg-yellow-500', 
      category: 'Looks',
      inputConfig: [
        { field: 'message', type: 'text', defaultValue: 'Hmm...' },
        { field: 'duration', type: 'number', defaultValue: 2, min: 0.1, step: 0.1 }
      ]
    },
    // Events Category
    {
        id: 'whenFlagClicked',
        label: 'When Flag Clicked',
        icon: <Play size={16} style={{ color: 'green' }} />, // Using Play icon, styled green
        color: 'bg-green-600',
        category: 'Events',
        inputConfig: null 
    },
    // Control Category
    { 
      id: 'repeat', 
      label: 'Repeat', 
      icon: <RotateCw size={16} />, 
      color: 'bg-gray-700', 
      category: 'Control',
      isContainer: true,
      inputConfig: { field: 'times', type: 'number', defaultValue: 4 } 
    }
  ], []); // Empty dependency array means it's created once

  // Function to add a new action to the selected pet's program
  const addAction = (actionType, targetPath = [], targetIndex = 0) => {
    if (!selectedPet) return;
    const actionConfig = actionTypes.find(at => at.id === actionType);
    if (!actionConfig) return;

    let value;
    if (actionConfig.inputConfig) {
      if (Array.isArray(actionConfig.inputConfig)) {
        value = {};
        actionConfig.inputConfig.forEach(input => {
          value[input.field] = JSON.parse(JSON.stringify(input.defaultValue));
        });
      } else {
        value = JSON.parse(JSON.stringify(actionConfig.inputConfig.defaultValue));
      }
    } else {
      value = undefined; 
    }

    const newAction = { 
      type: actionType, 
      id: Date.now() + Math.random(), 
      value: value,
      children: actionConfig.isContainer ? [] : undefined 
    };

    setPets(prev => {
      const newPets = JSON.parse(JSON.stringify(prev));
      let currentActions = newPets[selectedPet].actions;

      if (targetPath.length > 0) {
        let parentAction = currentActions[targetPath[0]];
        for (let i = 1; i < targetPath.length; i++) {
          parentAction = parentAction.children[targetPath[i]];
        }
        if (parentAction && parentAction.children !== undefined) { // Check for children array
          currentActions = parentAction.children;
        } else {
          targetIndex = currentActions.length;
          targetPath = [];
        }
      }
      
      currentActions.splice(targetIndex, 0, newAction);

      return newPets;
    });
  };

  // Function to remove an action from the selected pet's program (including nested actions)
  const removeAction = (actionId) => {
    if (!selectedPet) return;
    setPets(prev => {
      const newPets = JSON.parse(JSON.stringify(prev));
      newPets[selectedPet].actions = removeActionFromStructure(newPets[selectedPet].actions, actionId);
      return newPets;
    });
  };

  // Function to move/reorder an action in the program (including nested actions)
  const moveAction = useCallback((sourceId, targetPath, targetIndex) => {
    if (!selectedPet || sourceId === null) return;
  
    setPets(prev => {
      const newPets = JSON.parse(JSON.stringify(prev));
      
      let draggedActionData = null;
      let foundInPath = findActionAndParent(newPets[selectedPet].actions, sourceId);

      if (foundInPath) {
        draggedActionData = foundInPath.action;
        const sourceParentActions = foundInPath.parent ? foundInPath.parent.children : newPets[selectedPet].actions;
        sourceParentActions.splice(foundInPath.index, 1);
      } else {
        console.warn("Dragged action not found.");
        return prev;
      }
  
      let targetLevelActions = newPets[selectedPet].actions;
      let actualTargetIndex = targetIndex;

      if (targetPath.length > 0) {
          let targetParent = newPets[selectedPet].actions[targetPath[0]];
          for (let i = 1; i < targetPath.length; i++) {
              targetParent = targetParent.children[targetPath[i]];
          }
          if (targetParent && targetParent.children !== undefined) {
              targetLevelActions = targetParent.children;
          } else {
              console.warn("Invalid target path for nested drop, falling back to top level.");
              targetLevelActions = newPets[selectedPet].actions;
              actualTargetIndex = newPets[selectedPet].actions.length;
          }
      }

      targetLevelActions.splice(actualTargetIndex, 0, draggedActionData);
  
      return newPets;
    });
  }, [selectedPet]);

  // Function to update the value of an action's parameter
  const updateActionValue = useCallback((actionId, newValue, field = null) => {
    if (!selectedPet) return;
    setPets(prev => {
      const newPets = JSON.parse(JSON.stringify(prev));
      const { action: targetAction } = findActionAndParent(newPets[selectedPet].actions, actionId);
      if (targetAction) {
        const actionConfig = actionTypes.find(at => at.id === targetAction.type);
        if (actionConfig && actionConfig.inputConfig) {
          if (Array.isArray(actionConfig.inputConfig)) {
            if (field) {
              targetAction.value[field] = newValue;
            }
          } else {
            targetAction.value = newValue;
          }
        }
      }
      return newPets;
    });
  }, [selectedPet, actionTypes]);

  // Function to clear all actions for the selected pet
  const clearActions = () => {
    if (!selectedPet) return;
    setPets(prev => ({
      ...prev,
      [selectedPet]: {
        ...prev[selectedPet],
        actions: [],
        executionStack: []
      }
    }));
  };

  // Function to toggle whether a pet is active/visible on the stage
  const togglePet = (petId) => {
    setActivePets(prevActive => {
      const newActive = prevActive.includes(petId)
        ? prevActive.filter(id => id !== petId)
        : [...prevActive, petId];

      if (petId === selectedPet && !newActive.includes(petId)) {
        setSelectedPet(newActive.length > 0 ? newActive[0] : null);
      } else if (selectedPet === null && newActive.length > 0) {
        setSelectedPet(newActive[0]);
      }
      return newActive;
    });
  };

  // Function to check for collisions between two pets
  const checkCollision = useCallback((pet1, pet2) => {
    const distance = Math.sqrt(Math.pow(pet1.x - pet2.x, 2) + Math.pow(pet1.y - pet2.y, 2));
    return distance < 40;
  }, []);

  // Function to play a simple animal sound using Web Audio API
  const playAnimalSound = useCallback((petType) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      let frequency = 440;
      let duration = 0.1;
      if (petType === 'cat') { frequency = 700; duration = 0.15; }
      else if (petType === 'dog') { frequency = 200; duration = 0.2; }
      else if (petType === 'rabbit') { frequency = 500; duration = 0.1; }
      else if (petType === 'bird') { frequency = 1000; duration = 0.12; }

      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration + 0.05);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration + 0.1);
    } catch (error) {
      console.log('Audio not available, or an error occurred:', error);
    }
  }, []);

  // Function to execute a single action for a pet
  const executeSingleAction = useCallback((pet, action, petType, canvas) => {
    const newPet = { ...pet };
    
    switch (action.type) {
      case 'move': {
        const radians = (newPet.angle * Math.PI) / 180;
        newPet.x += Math.cos(radians) * action.value;
        newPet.y += Math.sin(radians) * action.value;
        break;
      }
      case 'turnCW':
        newPet.angle = (newPet.angle + action.value) % 360;
        if (newPet.angle < 0) newPet.angle += 360; 
        break;
      case 'turnCCW':
        newPet.angle = (newPet.angle + action.value) % 360;
        if (newPet.angle < 0) newPet.angle += 360; 
        break;
      case 'pointInDirection':
        newPet.angle = action.value;
        break;
      case 'goToXY':
        newPet.x = action.value.x;
        newPet.y = action.value.y;
        break;
      case 'goToRandomPosition':
        newPet.x = Math.random() * (canvas.width - 50) + 25;
        newPet.y = Math.random() * (canvas.height - 50) + 25;
        break;
      case 'say':
        newPet.message = action.value.message;
        newPet.messageTime = Date.now();
        playAnimalSound(petType);
        break;
      case 'think':
        newPet.message = `(thinking) ${action.value.message}`;
        newPet.messageTime = Date.now();
        playAnimalSound(petType);
        break;
      case 'repeat':
        newPet.message = `Repeating ${action.value} times!`; 
        newPet.messageTime = Date.now();
        break;
      case 'whenFlagClicked':
        break;
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
    
    newPet.x = Math.max(25, Math.min(canvas.width - 25, newPet.x));
    newPet.y = Math.max(25, Math.min(canvas.height - 25, newPet.y));
    
    return newPet;
  }, [playAnimalSound]); 

  // Main execution loop for pets
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setPets(prev => {
          const newPets = JSON.parse(JSON.stringify(prev));
          const canvas = canvasRef.current;
          const currentTime = Date.now();
          let anyPetStillRunning = false;

          activePets.forEach(petKey => {
            const pet = newPets[petKey];

            if (pet.executionStack.length === 0 && pet.actions.length > 0) {
              pet.executionStack.push({ actions: pet.actions, index: 0, iteration: 0 });
            }

            let lastExecutedAction = null; 

            if (pet.executionStack.length > 0) { 
              let currentFrame = pet.executionStack[pet.executionStack.length - 1];
              
              if (currentFrame.index < currentFrame.actions.length) {
                const currentActionObject = currentFrame.actions[currentFrame.index];
                const actionConfig = actionTypes.find(at => at.id === currentActionObject.type);

                if (actionConfig.isContainer && currentActionObject.type === 'repeat') {
                  if (currentFrame.iteration < currentActionObject.value) {
                    pet.executionStack.push({
                      actions: currentActionObject.children,
                      index: 0,
                      iteration: 0,
                      parentRepeatActionId: currentActionObject.id
                    });
                    pet.message = `Repeating ${currentActionObject.value} times!`;
                    pet.messageTime = Date.now();
                  } else {
                    currentFrame.index++;
                  }
                  anyPetStillRunning = true; 
                } else {
                  newPets[petKey] = executeSingleAction(pet, currentActionObject, petKey, canvas);
                  lastExecutedAction = currentActionObject;
                  currentFrame.index++;
                  anyPetStillRunning = true;
                }
              } else {
                pet.executionStack.pop();

                if (pet.executionStack.length > 0) {
                  let parentFrame = pet.executionStack[pet.executionStack.length - 1];
                  const parentRepeatAction = parentFrame.actions.find(a => a.id === currentFrame.parentRepeatActionId);

                  if (parentRepeatAction) {
                    parentFrame.iteration++;
                    if (parentFrame.iteration < parentRepeatAction.value) {
                      pet.executionStack.push({
                        actions: parentRepeatAction.children,
                        index: 0,
                        iteration: parentFrame.iteration,
                        parentRepeatActionId: parentRepeatAction.id
                      });
                    } else {
                      parentFrame.index++;
                      parentFrame.iteration = 0; 
                    }
                  } else {
                    parentFrame.index++;
                  }
                  anyPetStillRunning = true;
                }
              }
            } else {
            }
            
            if (pet.message && pet.messageTime > 0) {
              const messageActionDuration = lastExecutedAction && (lastExecutedAction.type === 'say' || lastExecutedAction.type === 'think')
                                           ? lastExecutedAction.value.duration * 1000
                                           : 2000;
              if (currentTime - pet.messageTime > messageActionDuration) {
                newPets[petKey].message = '';
                newPets[petKey].messageTime = 0;
              }
            }
          });

          for (let i = 0; i < activePets.length; i++) {
            for (let j = i + 1; j < activePets.length; j++) {
              const pet1Key = activePets[i];
              const pet2Key = activePets[j];
              if (checkCollision(newPets[pet1Key], newPets[pet2Key])) {
                if (isSwapEnabled && (newPets[pet1Key].actions.length > 0 || newPets[pet2Key].actions.length > 0)) {
                  const pet1Actions = [...newPets[pet1Key].actions];
                  const pet2Actions = [...newPets[pet2Key].actions];
                  newPets[pet1Key] = { ...newPets[pet1Key], actions: pet2Actions, executionStack: [], message: 'Swapped!', messageTime: currentTime };
                  newPets[pet2Key] = { ...newPets[pet2Key], actions: pet1Actions, executionStack: [], message: 'Swapped!', messageTime: currentTime };
                }
              }
            }
          }
          
          if (!anyPetStillRunning && isRunning) {
            setIsRunning(false);
          }

          return newPets;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isRunning, activePets, pets, isSwapEnabled, actionTypes, executeSingleAction, checkCollision]); 

  // Function to toggle running state
  const toggleRunning = () => {
    setIsRunning(prev => {
      if (!prev) { // If starting the simulation
        setPets(currentPets => {
          const updatedPets = JSON.parse(JSON.stringify(currentPets));
          activePets.forEach(petKey => {
            updatedPets[petKey].executionStack = []; // Clear stack to restart
            updatedPets[petKey].message = ''; // Clear old messages
            updatedPets[petKey].messageTime = 0;
          });
          return updatedPets;
        });
      }
      return !prev;
    });
  };

  // Function to reset pets to their initial positions and clear messages/current actions
  const resetPets = () => {
    setIsRunning(false);
    setPets(prev => {
      const newPets = { ...prev };
      // Reset position and angle for all pets
      Object.keys(newPets).forEach((petKey, i) => {
        newPets[petKey] = {
          ...newPets[petKey],
          x: (i % 2 === 0 ? 100 : 400),
          y: (i < 2 ? 100 : 200),
          angle: (i % 2 === 0 ? 0 : 180),
          executionStack: [],
          message: '',
          messageTime: 0
        };
      });
      return newPets;
    });
  };

  // Helper to get canvas coordinates from mouse event
  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Helper to determine which pet is at a given canvas position
  const getPetAtPosition = (x, y) => {
    for (const petKey of activePets.slice().reverse()) {
      const pet = pets[petKey];
      const distance = Math.sqrt(Math.pow(pet.x - x, 2) + Math.pow(pet.y - y, 2));
      if (distance <= 25) {
        return petKey;
      }
    }
    return null;
  };

  // Canvas mouse down event handler for dragging pets
  const handleCanvasMouseDown = (e) => {
    if (isRunning) return;
    const { x: mouseX, y: mouseY } = getCanvasCoordinates(e.nativeEvent);
    const petAtPosition = getPetAtPosition(mouseX, mouseY);
    
    if (petAtPosition) {
      setIsDraggingPet(true);
      setDraggedPet(petAtPosition);
      setDragOffset({
        x: mouseX - pets[petAtPosition].x,
        y: mouseY - pets[petAtPosition].y
      });
      e.preventDefault();
    }
  };

  // Canvas mouse move event handler for dragging pets
  const handleCanvasMouseMove = (e) => {
    if (!isDraggingPet || !draggedPet) return;
    const { x: mouseX, y: mouseY } = getCanvasCoordinates(e.nativeEvent);
    setPets(prev => ({
      ...prev,
      [draggedPet]: {
        ...prev[draggedPet],
        x: Math.max(25, Math.min(canvasRef.current.width - 25, mouseX - dragOffset.x)),
        y: Math.max(25, Math.min(canvasRef.current.height - 25, mouseY - dragOffset.y))
      }
    }));
  };

  // Canvas mouse up event handler to stop dragging pets
  const handleCanvasMouseUp = () => {
    setIsDraggingPet(false);
    setDraggedPet(null);
  };
  
  // Drag start handler for action blocks from the palette
  const handleActionBlockDragStart = (e, actionId) => {
    e.dataTransfer.setData('actionType', actionId); // Renamed to actionType
    e.dataTransfer.setData('source', 'actionBlock');
    e.currentTarget.classList.add('scale-105', 'shadow-lg'); // Visual feedback on drag start
  };

  // Drag start handler for actions already in the program
  const handleProgramItemDragStart = (e, actionId, path) => {
    setDraggedActionId(actionId);
    e.dataTransfer.setData('sourceId', actionId);
    e.dataTransfer.setData('sourcePath', JSON.stringify(path)); // Pass path as string
    e.dataTransfer.setData('source', 'programItem');
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('scale-105', 'shadow-lg'); // Visual feedback on drag start
  };

  // Drag over handler for program list items (to show drop target)
  const handleDragOverProgram = (e, targetPath, targetIndex, dropTargetType = 'sibling') => {
    e.preventDefault();
    setDragOverTarget({ path: targetPath, index: targetIndex, type: dropTargetType });
  };

  // Drop handler for program list items (reordering or adding from palette)
  const handleDropOnProgram = (e, targetPath, targetIndex, dropType = 'sibling') => {
    e.preventDefault();
    setDragOverTarget(null); // Clear drag over highlight

    const source = e.dataTransfer.getData('source');
    
    if (source === 'programItem') {
      const sourceId = e.dataTransfer.getData('sourceId');
      const sourcePath = JSON.parse(e.dataTransfer.getData('sourcePath'));

      // Avoid dropping an action onto itself using its original path and target index
      if (JSON.stringify(sourcePath) === JSON.stringify(targetPath) && sourcePath[sourcePath.length - 1] === targetIndex) {
        return;
      }
      
      moveAction(sourceId, targetPath, targetIndex);

    } else if (source === 'actionBlock') {
      const actionType = e.dataTransfer.getData('actionType');

      // If dropType is 'child', targetPath already points to the parent, targetIndex is 0 (first child)
      if (dropType === 'child') {
        addAction(actionType, targetPath, 0); // Add as first child of the container
      } else {
        addAction(actionType, targetPath, targetIndex); // Add as a sibling at the given index
      }
    }
    setDraggedActionId(null);
  };
  
  // Drop handler for the overall program container (adds to end of top-level list)
  const handleDropOnContainer = (e) => {
    e.preventDefault();
    setDragOverTarget(null); // Clear drag over highlight
    const source = e.dataTransfer.getData('source');
    if (source === 'actionBlock') {
        const actionType = e.dataTransfer.getData('actionType');
        addAction(actionType, [], pets[selectedPet].actions.length); // Add to the end of the top-level list
    }
  };

  // Effect hook for drawing on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f0f9ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#dbeafe';
    ctx.lineWidth = 1;
    for(let i = 25; i < canvas.width; i+=25) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
    for(let i = 25; i < canvas.height; i+=25) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }
    
    activePets.forEach(petKey => {
      const pet = pets[petKey];
      const petConfig = petOptions.find(p => p.id === petKey);
      const isBeingDragged = isDraggingPet && draggedPet === petKey;
      
      ctx.save();
      ctx.translate(pet.x, pet.y);
      if (isBeingDragged) {
        ctx.shadowColor = petConfig.color;
        ctx.shadowBlur = 20;
      }
      ctx.rotate((pet.angle * Math.PI) / 180);
      
      ctx.fillStyle = petConfig.color;
      ctx.strokeStyle = isBeingDragged ? '#0ea5e9' : '#1f2937';
      ctx.lineWidth = isBeingDragged ? 4 : 2;

      ctx.beginPath();
      ctx.arc(0,0,20,0,Math.PI*2);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = isBeingDragged ? '#0ea5e9' : '#1f2937';
      ctx.beginPath();
      ctx.moveTo(20, 0); ctx.lineTo(10, -7); ctx.lineTo(10, 7);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
      
      ctx.shadowBlur = 0;
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(petConfig.emoji, pet.x, pet.y);
      
      if (pet.message) {
        ctx.font = 'bold 14px sans-serif';
        const textWidth = ctx.measureText(pet.message).width;
        const bubbleWidth = textWidth + 20, bubbleHeight = 30;
        const bubbleX = pet.x - bubbleWidth / 2, bubbleY = pet.y - 60;
        ctx.fillStyle = 'white'; ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bubbleX, bubbleY); ctx.lineTo(bubbleX + bubbleWidth, bubbleY);
        ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight); ctx.lineTo(pet.x + 10, bubbleY + bubbleHeight);
        ctx.lineTo(pet.x, bubbleY + bubbleHeight + 10); ctx.lineTo(pet.x - 10, bubbleY + bubbleHeight);
        ctx.lineTo(bubbleX, bubbleY + bubbleHeight); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1f2937'; ctx.fillText(pet.message, pet.x, bubbleY + 16);
      }
    });
  }, [pets, activePets, isDraggingPet, draggedPet, petOptions]);

  // Recursive rendering of program actions
  const renderProgramActions = (actions, path = []) => {
    return actions.map((action, index) => {
      const actionType = actionTypes.find(at => at.id === action.type);
      if (!actionType) return null;

      const currentPath = [...path, index];
      const isDraggingThis = draggedActionId === action.id; 
      const isDragOverSibling = dragOverTarget && dragOverTarget.type === 'sibling' && JSON.stringify(dragOverTarget.path) === JSON.stringify(path) && dragOverTarget.index === index;
      const isDragOverChild = dragOverTarget && dragOverTarget.type === 'child' && JSON.stringify(dragOverTarget.path) === JSON.stringify(currentPath) && actionType.isContainer;

      const renderInputField = (inputConfig, currentActionValue) => {
        // Handle different input types (number, coords, text_duration)
        if (Array.isArray(inputConfig)) {
          return (
            <span className="flex items-center gap-1">
              {inputConfig.map((config, i) => (
                <React.Fragment key={i}>
                  {config.type === 'text' && (
                    <input
                      type="text"
                      value={currentActionValue[config.field]}
                      onChange={(e) => updateActionValue(action.id, e.target.value, config.field)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-24 ml-2 p-1 rounded bg-white bg-opacity-20 text-white focus:outline-none focus:ring-2 focus:ring-white/50 hover:bg-opacity-30" 
                      placeholder={config.field}
                    />
                  )}
                  {config.type === 'number' && (
                    <>
                      {config.field !== 'steps' && config.field !== 'degrees' && ( 
                        <span className="ml-2">{config.field.slice(0,1)}:</span>
                      )}
                      <input
                        type="number"
                        min={config.min}
                        step={config.step}
                        value={currentActionValue[config.field]}
                        onChange={(e) => updateActionValue(action.id, parseFloat(e.target.value) || 0, config.field)}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-16 ${config.field !== 'steps' && config.field !== 'degrees' ? 'ml-1' : 'ml-2'} p-1 rounded bg-white bg-opacity-20 text-white text-right focus:outline-none focus:ring-2 focus:ring-white/50 hover:bg-opacity-30`} 
                      />
                    </>
                  )}
                  {config.field === 'duration' && <span className="ml-1">secs</span>}
                </React.Fragment>
              ))}
            </span>
          );
        } else if (inputConfig.type === 'number') {
          return (
            <input
              type="number"
              value={currentActionValue}
              onChange={(e) => updateActionValue(action.id, parseInt(e.target.value) || 0)}
              onClick={(e) => e.stopPropagation()}
              className="w-16 ml-2 p-1 rounded bg-white bg-opacity-20 text-white text-right focus:outline-none focus:ring-2 focus:ring-white/50 hover:bg-opacity-30" 
            />
          );
        }
        return null; 
      };

      const actionBlockClasses = `${actionType.color} flex flex-wrap items-center justify-between p-2 rounded text-white text-sm cursor-grab transition-all duration-100 ${isDraggingThis ? 'opacity-50 scale-105 shadow-lg' : 'shadow-md hover:shadow-lg hover:scale-[1.01]'}`;
      const dropSiblingClasses = `h-2 transition-all duration-100 ${isDragOverSibling ? 'h-8 bg-purple-300 rounded my-1' : ''}`;
      const containerChildClasses = `border-l-2 border-slate-400 ml-4 pl-2 rounded transition-all duration-100 ${isDragOverChild ? 'border-dashed border-purple-400 bg-purple-50' : ''}`;

      return (
        <div key={action.id} style={{ paddingLeft: `${path.length * 20}px` }}> {/* Indent children */}
          {/* Drop target for sibling */}
          <div 
            onDragOver={(e) => handleDragOverProgram(e, path, index, 'sibling')} 
            onDrop={(e) => handleDropOnProgram(e, path, index, 'sibling')}
            className={dropSiblingClasses}
          ></div>
          <div 
            draggable 
            onDragStart={(e) => handleProgramItemDragStart(e, action.id, currentPath)} 
            onDragEnd={(e) => {
              setDraggedActionId(null); 
              setDragOverTarget(null);
              e.currentTarget.classList.remove('scale-105', 'shadow-lg'); 
            }}
            // On drop on the block itself, it means "drop as child" if it's a container
            onDrop={(e) => actionType.isContainer ? handleDropOnProgram(e, currentPath, 0, 'child') : handleDropOnProgram(e, path, index, 'sibling')} 
            onDragOver={(e) => {
              if (actionType.isContainer) { 
                handleDragOverProgram(e, currentPath, 0, 'child');
              } else {
                handleDragOverProgram(e, path, index, 'sibling');
              }
            }}
            className={actionBlockClasses}
          >
            <span className="flex items-center gap-2">
              <GripVertical size={14} className="cursor-grab" />
              {actionType.icon} 
              {actionType.label}
            </span>
            {/* Render input field based on action type's inputConfig */}
            {actionType.inputConfig && renderInputField(actionType.inputConfig, action.value)}
            <button onClick={(e) => { e.stopPropagation(); removeAction(action.id); }} className="text-white/70 hover:text-white font-bold ml-2 transition-colors">✕</button>
          </div>
          {/* Render children recursively if it's a container block */}
          {actionType.isContainer && (
            <div className={containerChildClasses}> {/* Visual line for container */}
              {action.children && action.children.length > 0 && renderProgramActions(action.children, currentPath)}
              {/* Optional inner drop target for empty containers */}
              {action.children && action.children.length === 0 && isDragOverChild && (
                <div 
                  onDragOver={(e) => handleDragOverProgram(e, currentPath, 0, 'child')} 
                  onDrop={(e) => handleDropOnProgram(e, currentPath, 0, 'child')}
                  className="h-16 flex items-center justify-center text-slate-400 text-xs border-2 border-dashed border-purple-300 rounded m-1 transition-all duration-100"
                >
                  Drop here
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  const canvasCursorClass = isDraggingPet ? 'cursor-grabbing' : (isRunning ? 'cursor-not-allowed' : 'cursor-grab');

  // Control button classes
  const runButtonClasses = `px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg ${isRunning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`;
  const resetButtonClasses = `px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg bg-red-500 hover:bg-red-600 text-white`;
  const swapButtonClasses = `px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg ${isSwapEnabled ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-400 hover:bg-gray-500 text-white'}`;

  return (
    <div className="w-full min-h-screen bg-[#4c97ff] font-sans flex flex-col items-center p-4"> {/* Scratch-like blue background */}
      <div className="w-full max-w-7xl mx-auto bg-white rounded-xl shadow-2xl p-4 sm:p-6 lg:p-8 flex flex-col gap-4">
        <header className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800">🐾 Scratch Clone 🐾</h1>
        </header>
        
        {/* Top Tabs: Code | Costumes | Sounds */}
        <div className="flex bg-gray-100 rounded-t-lg border-b border-gray-200 text-gray-700">
            <button className="px-6 py-2 border-r border-gray-200 font-semibold bg-gray-200 text-blue-700 rounded-tl-lg">Code</button>
            <button className="px-6 py-2 border-r border-gray-200 hover:bg-gray-200">Costumes</button>
            <button className="px-6 py-2 hover:bg-gray-200">Sounds</button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_3fr_2fr] gap-6 flex-grow">
          {/* Left Column: Action Blocks Palette */}
          <div className="flex flex-col gap-4 overflow-y-auto pr-1"> {/* Added overflow for palette scrolling */}
            {['Motion', 'Looks', 'Control', 'Events'].map(category => (
              <div key={category} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold mb-3 text-slate-700">{category} Actions</h3>
                <div className="flex flex-col gap-2"> 
                  {actionTypes.filter(at => at.category === category).map(actionType => (
                    <button key={actionType.id} draggable onDragStart={(e) => handleActionBlockDragStart(e, actionType.id)} onClick={() => addAction(actionType.id)} className={`${actionType.color} w-full px-3 py-2 rounded-lg text-white font-medium flex items-center gap-2 hover:opacity-90 transition-transform hover:scale-105 cursor-grab shadow-sm hover:shadow-md`}>
                      {actionType.icon} {actionType.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Middle Column: Code Area (formerly Program Area) */}
          <div className={`bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col`} onDragOver={(e) => e.preventDefault()} onDrop={handleDropOnContainer}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-slate-700">
                {selectedPet ? petOptions.find(p => p.id === selectedPet)?.emoji : '🏁'} Code Area
              </h3>
              {selectedPet && <button onClick={clearActions} className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-semibold flex items-center gap-1">Clear</button>}
            </div>
            <div className="space-y-1 flex-grow overflow-y-auto pr-1">
              {selectedPet && pets[selectedPet].actions.length === 0 ? (
                <div className={`h-full flex items-center justify-center text-center text-slate-500 text-sm p-4 rounded-lg border-2 border-dashed ${dragOverTarget === null ? 'border-slate-300' : 'border-purple-400 bg-purple-50'}`}>Drag and drop action blocks here to build your program.</div>
              ) : (
                renderProgramActions(pets[selectedPet].actions)
              )}
              <div onDragOver={(e) => handleDragOverProgram(e, [], pets[selectedPet].actions.length, 'sibling')} className={`h-2 transition-all duration-100 ${dragOverTarget && dragOverTarget.type === 'sibling' && JSON.stringify(dragOverTarget.path) === JSON.stringify([]) && dragOverTarget.index === pets[selectedPet].actions.length ? 'h-8 bg-purple-200 rounded my-1' : ''}`}></div>
            </div>
          </div>
          
          {/* Right Column: Stage (top) and Sprite/Backdrop Area (bottom) */}
          <div className="flex flex-col gap-6"> 
            {/* Stage Section */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex-shrink-0">
              <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                <h2 className="text-xl font-semibold text-slate-700">Stage</h2>
                <div className="flex gap-2">
                  <button onClick={toggleRunning} className={runButtonClasses}>
                    {isRunning ? <Pause size={16} /> : <Play size={16} />} {isRunning ? 'Stop' : 'Run'}
                  </button>
                  <button onClick={resetPets} className={resetButtonClasses}>
                    <RotateCcw size={16} /> Reset
                  </button>
                  <button 
                    onClick={() => setIsSwapEnabled(prev => !prev)} 
                    className={swapButtonClasses}>
                    <MessageCircle size={16} /> {isSwapEnabled ? 'Disable Action Swap' : 'Enable Action Swap'}
                  </button>
                </div>
              </div>
              <canvas ref={canvasRef} width={500} height={300} className={`border-2 border-slate-300 rounded-lg bg-white w-full h-auto aspect-[5/3] ${canvasCursorClass}`}
                onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}
              />
            </div>

            {/* Sprites & Backdrops Area */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex-grow">
              <h3 className="text-lg font-semibold mb-3 text-slate-700">Sprites & Backdrops</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                  {petOptions.map(pet => {
                      const spriteButtonClasses = `px-2 py-1 rounded-full font-semibold text-xs flex items-center justify-center gap-1 transition-all ${activePets.includes(pet.id) ? 'bg-sky-500 text-white' : 'bg-white text-gray-700 border hover:bg-sky-100'}`;
                      return (
                          <button key={pet.id} onClick={() => {
                              togglePet(pet.id);
                              setSelectedPet(pet.id);
                          }} className={spriteButtonClasses}>
                              {pet.emoji} {pet.name} {activePets.includes(pet.id) ? '✓' : ''}
                          </button>
                      );
                  })}
              </div>
              <p className="text-sm text-slate-500 text-center">Click a pet to activate/deactivate and select it for programming.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PetProgrammersApp;
