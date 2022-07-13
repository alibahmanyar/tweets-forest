import * as THREE from './build/three.module.js';

export class InputManager {
    constructor(window) {
      this.keys = {};
      this.mouse = {leftPressed: false, leftJustPressed: false, leftJustReleased: false,
                    rightPressed: false, rightJustPressed: false, rightJustReleased: false};
      const keyMap = new Map();
   
      const setKey = (keyName, pressed) => {
        const keyState = this.keys[keyName];
        keyState.justPressed = pressed && !keyState.down;
        keyState.justReleased = !pressed && keyState.down;
        keyState.down = pressed;
      };
   
      const addKey = (keyCode, name) => {
        this.keys[name] = { down: false, justPressed: false, justReleased: false };
        keyMap.set(keyCode, name);
      };
   
      const setKeyFromKeyCode = (keyCode, pressed) => {
        const keyName = keyMap.get(keyCode);
        if (!keyName) {
          return;
        }
        setKey(keyName, pressed);
      };
   
      addKey(37, 'left');
      addKey(39, 'right');
      addKey(38, 'up');
      addKey(40, 'down');
      addKey(65, 'a');
      addKey(87, 'w');
      addKey(83, 's');
      addKey(68, 'd');
      addKey(32, 'space');
   
      window.addEventListener('keydown', (e) => {
        setKeyFromKeyCode(e.keyCode, true);
      });
      window.addEventListener('keyup', (e) => {
        setKeyFromKeyCode(e.keyCode, false);
      });
      window.addEventListener('mousedown', (e) => {
        if (e.button == 0) {   // left
          this.mouse.leftJustPressed = !this.leftPressed;
          this.mouse.leftPressed = true;
        }
        else if (e.button == 2) {  // right
          this.mouse.rightJustPressed = !this.rightPressed;
          this.mouse.rightPressed = true;
        }
        
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button == 0) {   // left
          this.mouse.leftJustReleased = this.mouse.leftPressed;
          this.mouse.leftPressed = false;
        }
        else if (e.button == 2) {  // right
          this.mouse.rightJustReleased = this.mouse.rightPressed;
          this.mouse.rightPressed = false;
        }
      });
    }
    update() {
      for (const keyState of Object.values(this.keys)) {
        if (keyState.justPressed) {
          keyState.justPressed = false;
        }
        if (keyState.justReleased) {
          keyState.justReleased = false;
        }
      }
      if (this.mouse.leftJustReleased){
        this.mouse.leftJustReleased = false;
      }
      if (this.mouse.leftJustPressed){
        this.mouse.leftJustPressed = false;
      }
      if (this.mouse.rightJustReleased){
        this.mouse.rightJustReleased = false;
      }
      if (this.mouse.rightJustPressed){
        this.mouse.rightJustPressed = false;
      }
    }
  }

export class CameraControl{
    constructor(camera, speed){
        this.camera = camera;
        this.speed = speed;
    }
    update(delta, movment){
        // movment is a 4 elemental array 0=>forward 1=>right 2=>back 3=>left

    }

}

export class PickHelper {
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.pickedObject = null;
    this.pickedObjectSavedColor = 0;
  }
  pick(normalizedPosition, scene, camera, time) {
    // cast a ray through the frustum
    this.raycaster.setFromCamera({x: 0, y: 0}, camera);
    // get the list of objects the ray intersected
    const intersectedObjects = this.raycaster.intersectObjects(scene.children);
    if (intersectedObjects.length) {
      // pick the first object. It's the closest one
      this.pickedObject = intersectedObjects[0].object;
      if (this.pickedObject.data !== undefined){
        return this.pickedObject.data.url;
      }
      else{
        return undefined;
      }
    }
  }
}

export function wrapText(context, text, x, y, maxWidth, lineHeight, size, color, mode) {
  var words = text.split(' ');
  var line = '';

  context.font = size + "px calibri";
  context.fillStyle = color;
  if (mode == "rtl"){
    context.textAlign = 'right';
    context.direction = 'rtl';
    x = 1 - x;
  }
  else{
    context.textAlign = 'left';
    context.direction = 'ltr';
  }

  x = x * context.canvas.width;
  y = y * context.canvas.height;

  for(var n = 0; n < words.length; n++) {
    var testLine = line + words[n] + ' ';
    var metrics = context.measureText(testLine);
    var testWidth = metrics.width;
    if (testWidth > maxWidth * context.canvas.width && n > 0) {
      context.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    }
    else {
      line = testLine;
    }
  }
  context.fillText(line, x, y); 
}

export function get_time_passed(deltaSeconds){
  let days = Math.floor(deltaSeconds / 86400);
  let hours = Math.floor(deltaSeconds / 3600);
  let mins = Math.floor(deltaSeconds / 60);
  let seconds = Math.floor(deltaSeconds);

  let times = [days, hours, mins, seconds]
  let labels = ['d', 'h', 'm', 's']
  
  for (let i = 0; i < times.length; i++){
    if (times[i] != 0){
      return (times[i].toString() + labels[i]);
    }
  }
}