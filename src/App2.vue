<template>
    <div style="position: absolute; right: 20%; color: red;">
      <h1>Laps: {{ laps }}</h1>
      <h1>Points: {{ points }}</h1>
    </div>
    <canvas ref="canvas" id="carDriving" width="1900" height="1900" ></canvas>
  </template>
  
  <script setup>
  import {ref, onMounted} from 'vue';
  
  const canvas = ref(null);
  
  const keys = {
    'w': false,
    'a': false,
    's': false,
    'd': false,
  }
  
  let points = ref();
  points.value = 0
  let laps = ref();
  laps.value = 0
  
  const trackWidth = 100;
  
  class Track {
    constructor(ctx, points, checkPoints) {
      this.ctx = ctx;
      this.points = points;
      this.checkPoints = checkPoints;
    }
  
  
    draw() {
      drawLines(this.ctx, this.points, trackWidth + 10 * 2, 'red', true);
  
      drawLines(this.ctx, this.points, trackWidth, 'gray', false);
  
      for (let i = 0; i < this.checkPoints.length; i++) {
        let color = 'rgba(50, 205, 50, 0.5)';
        if (i === 0) {
          color = 'rgba(255, 255, 255, 1)';
        }
        drawCheckPoint(this.ctx, this.checkPoints[i].x, this.checkPoints[i].y, this.checkPoints[i].rotation, color);
      }
    }
  
    collides(x, y, width, height, rotation) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.points[0].x * trackWidth, this.points[0].y * trackWidth);
      for(let i = 1; i < this.points.length; i += 3) {
        this.ctx.bezierCurveTo(
          this.points[i].x * trackWidth, this.points[i].y * trackWidth,
          this.points[i + 1].x * trackWidth, this.points[i + 1].y * trackWidth,
          this.points[i + 2].x * trackWidth, this.points[i + 2].y * trackWidth
        );
      }
      this.ctx.closePath();
  
      let x1 = x + 10;
      let y1 = y - height / 2 + 10;
      let x2 = x + width - 50;
      let y2 = y + height / 2 - 10;
  
      const coord = [
        {x: x1, y: y1},
        {x: x2, y: y1},
        {x: x2, y: y2},
        {x: x1, y: y2},
      ];
  
      let dead = false
      coord.forEach(c => {
        const car = rotate(x, y, c.x, c.y, -rotation);
        if (!this.ctx.isPointInStroke(car.x, car.y)) {
          dead = true;
          return;
        }
      });
  
      return dead;
    }
  
    checkPointCollides(x, y) {
      for (let i = 0; i < this.checkPoints.length; i++) {
        this.ctx.save()
  
        this.ctx.translate(this.checkPoints[i].x * trackWidth, this.checkPoints[i].y * trackWidth);
        this.ctx.rotate(this.checkPoints[i].rotation);
  
        this.ctx.beginPath();
  
        this.ctx.rect(-trackWidth / 2, -trackWidth / 2, 0.5 * trackWidth / 2, trackWidth);
  
        if (this.ctx.isPointInPath(x, y)) {
          this.ctx.closePath();
          this.ctx.restore();
          return this.checkPoints[i].id;
        }
  
        this.ctx.closePath();
        this.ctx.restore();
      }
    }
  }
  
  function drawLines(ctx, points, width, color, stroke = false) {
    ctx.beginPath();
    ctx.moveTo(points[0].x * trackWidth, points[0].y * trackWidth);
  
    for (let i = 1; i < points.length; i += 3) {
      ctx.bezierCurveTo(
        points[i].x * trackWidth, points[i].y * trackWidth,
        points[i + 1].x * trackWidth, points[i + 1].y * trackWidth,
        points[i + 2].x * trackWidth, points[i + 2].y * trackWidth
      );
    }
  
    ctx.strokeStyle = color; // road lines
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.closePath();
  
    if (stroke) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = width - 10;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  
  function drawCheckPoint(ctx, x, y, rotation, color) {
    ctx.save()
  
    ctx.translate(x * trackWidth, y * trackWidth);
    ctx.rotate(rotation);
  
    ctx.beginPath();
  
    ctx.rect(-trackWidth / 2, -trackWidth / 2, 0.5 * trackWidth / 2, trackWidth);
    ctx.fillStyle = color;
    ctx.fill();
    
    ctx.closePath();
    ctx.restore();
  }
  
  class Car {
    constructor(ctx, x, y, width, height, speed, direction, image) {
      this.ctx = ctx;
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.speed = speed;
      this.maxSpeed = 6;
      this.acceleration = 0.1;
      this.deceleration = 0.05;
      this.direction = direction;
      this.image = image;
      this.currentCheckPoint = 0;
      this.draw = this.draw.bind(this);
    }
  
    draw() {
      this.ctx.save(); // Save the current state
      this.ctx.translate(this.x, this.y);
      this.ctx.rotate(this.direction);
      this.ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
      this.ctx.restore(); // Restore the saved state
    }
  
    crossCheckPoint(track) {
      let checkPointId = track.checkPointCollides(this.x, this.y) || null;
      if (checkPointId != null) {
        if (this.currentCheckPoint + 1 === checkPointId) {
          this.currentCheckPoint++;
          points.value++;
        } else if (checkPointId === track.checkPoints[0].id && this.currentCheckPoint === track.checkPoints[track.checkPoints.length - 1].id) {
          this.currentCheckPoint = 0;
          laps.value++;
        } else if (this.currentCheckPoint !== checkPointId) {
          if (this.currentCheckPoint > 0) {
            let lastCheckPoint = track.checkPoints.find(cp => cp.id === this.currentCheckPoint);
            this.respawn(lastCheckPoint.x * trackWidth, lastCheckPoint.y * trackWidth, lastCheckPoint.rotation);
          } else {
            this.respawn((track.points[0].x - 1) * trackWidth, track.points[0].y * trackWidth, 0);
          }
          return;
        }
      }
    }
  
    move(track, brake = false) {
      if (!brake) {
        // Accelerate
        this.speed += this.acceleration;
        if (this.speed > this.maxSpeed) {
          this.speed = this.maxSpeed; // Limit speed to maximum
        }
      } else if (brake) {
        // Decelerate
        this.speed -= this.deceleration;
        if (this.speed < 0) {
          this.speed = 0; // Prevent negative speed
        }
      }
        
        // Move the car based on its current speed and direction
        this.x += this.speed * Math.cos(this.direction);
        this.y += this.speed * Math.sin(this.direction);
        if (track.collides(this.x, this.y, this.width, this.height, this.direction)) {
          this.crashed = true;
          if (this.currentCheckPoint > 0) {
            let lastCheckPoint = track.checkPoints.find(cp => cp.id === this.currentCheckPoint);
            this.respawn(lastCheckPoint.x * trackWidth, lastCheckPoint.y * trackWidth, lastCheckPoint.rotation);
          } else {
            this.respawn((track.points[0].x - 1) * trackWidth, track.points[0].y * trackWidth, degreesToRadians(0));
          }
        }
        
        this.crossCheckPoint(track);
      }
  
    rotate(deltaAngle) {
      this.direction += deltaAngle;
    }
  
    respawn(x, y, rotation) {
      this.x = x;
      this.y = y;
      this.crashed = false;
      this.direction = rotation;
      this.speed = 0;
      this.distanceFromCollision = 0;
    }
  }
  
  function rotate(cx, cy, x, y, angleRadians) {
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);
    const newX = (cos * (x - cx)) + (sin * (y - cy)) + cx;
    const newY = (cos * (y - cy)) - (sin * (x - cx)) + cy;
    return {x: newX, y: newY};
  }
  
  function degreesToRadians(degrees) {
    const pi = Math.PI;
  
    return degrees * pi / 180;
  }
  
  let track;
  
  onMounted(async () => {
    const canvasElement = canvas.value;
    canvasElement.width = window.innerWidth - 20;
    canvasElement.height = window.innerHeight - 20;
  
    const ctx = canvas.value.getContext('2d');
    if (!ctx) {
      console.log('Failed to get canvas context')
      return;
    }
  
    const checkPoints = [
      {id: 1, x: 19, y: 1, rotation: degreesToRadians(0)},
      {id: 2, x: 25.25, y: 3, rotation: degreesToRadians(90)},
      {id: 3, x: 28, y: 7, rotation: degreesToRadians(332)},
      {id: 4, x: 30, y: 9, rotation: degreesToRadians(85)},
      {id: 5, x: 26, y: 10.5, rotation: degreesToRadians(190)},
      {id: 6, x: 27, y: 13, rotation: degreesToRadians(335)},
      {id: 7, x: 23, y: 16, rotation: degreesToRadians(190)},
      {id: 8, x: 19.5, y: 4, rotation: degreesToRadians(283)},
      {id: 9, x: 16, y: 3, rotation: degreesToRadians(180)},
      {id: 10, x: 10, y: 5, rotation: degreesToRadians(182)},
      {id: 11, x: 6, y: 3, rotation: degreesToRadians(180)},
      {id: 12, x: 1, y: 2, rotation: degreesToRadians(270)},
      {id: 13, x: 4, y: 1.25, rotation: degreesToRadians(3)},
    ];
  
    const trackPoints = [
      { x: 19, y: 1 }, // Start
  
      // Turn 01
      { x: 22, y: 1 },
      { x: 24, y: 1.25 },
      { x: 24.5, y: 1.25 },
  
      { x: 25.25, y: 1.25 },
      { x: 25.25, y: 1.25 },
      { x: 25.25, y: 2 },
  
      // Straight up to turn 02
      { x: 25.25, y: 2 },
      { x: 25.25, y: 3 },
      { x: 25.25, y: 3 },
  
      // Turn 02
      { x: 25.25, y: 4 },
      { x: 25.5, y: 5 },
      { x: 25.5, y: 6 },
  
      // Turn 03
      { x: 25.5, y: 7 },
      { x: 26.5, y: 8 },
      { x: 28, y: 7 },
  
      // Turn 04
      { x: 29, y: 6 },
      { x: 30, y: 8 },
      { x: 30, y: 9 },
  
      // Small straight to turn 05
      { x: 30, y: 10 },
      { x: 30.5, y: 11 },
      { x: 30.5, y: 11.5 },
  
      // Turn 05
      { x: 30.5, y: 13 },
      { x: 29, y: 11 },
      { x: 26, y: 10.5 },
  
      // Turn 06
      { x: 23, y: 11 },
      { x: 23, y: 12 },
      { x: 23.5, y: 13 },
  
      { x: 24, y: 14 },
      { x: 25, y: 14 },
      { x: 27, y: 13 },
  
      // Turn 07
      { x: 29, y: 13 },
      { x: 29, y: 15 },
      { x: 29, y: 16 },
  
      // Turn 08
      { x: 29, y: 16.5 },
      { x: 26, y: 16.5 },
      { x: 23, y: 16 },
  
      // Turn 09
      { x: 21, y: 15.5 },
      { x: 21, y: 15 },
      { x: 21, y: 14 },
  
      // Straight up to turn 10
      { x: 21, y: 10 },
      { x: 20, y: 11 },
      { x: 19, y: 11 },
  
      // Turn 10
      { x: 19, y: 11 },
      { x: 18, y: 11 },
      { x: 19.5, y: 4 },
  
      // Turn 11
      { x: 19.5, y: 3 },
      { x: 18, y: 3 },
      { x: 17, y: 3 },
  
      // Turn 12
      { x: 20, y: 3 },
      { x: 14, y: 3 },
  
      // Turn 13 & 14
      { x: 14, y: 3 },
  
      { x: 12, y: 6 },
      { x: 14, y: 5 },
      { x: 9, y: 5 },
  
      // Turn 15
      { x: 9, y: 5 },
      { x: 9, y: 4 },
      { x: 9, y: 3 },
  
      { x: 6, y: 3 },
  
      // Turn 16
      { x: 5, y: 3 },
      { x: 4, y: 3 },
  
      // Turn 17
      { x: 3, y: 3 },
      { x: 2, y: 5 },
      
      // Turn 18
      { x: 1, y: 4 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
  
      // Turn 19
      { x: 3, y: 1 },
      { x: 3, y: 1.25 },
      { x: 4, y: 1.25 },
  
      // Finish line
      { x: 5, y: 1.25 },
      { x: 7, y: 1 },
      { x: 19, y: 1 },
    ];
    track = new Track(ctx, trackPoints, checkPoints);
  
  
    let img = new Image();
    img.onload = function() {
      console.log('Image loaded');
    }
    img.src = '/src/assets/pitstop_car_11.png';
  
    const car = new Car(ctx, (track.points[0].x - 1) * trackWidth, 1 * trackWidth, 70, 40, 0, 0, img);
  
    async function gameLoop() {
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      track.draw();
  
  
      // Apply the actions to the car
      if (keys['w']) {
        car.move(track);
      } else if (keys['s']) {
        car.move(track, true);
      } else {
        car.move(track, true);
      }
  
      
      let rotation = 0;
      if (keys['a']) {
        rotation = -0.05 / car.speed;
        if (rotation < -0.05) {
          rotation = -0.05;
        }
        car.rotate(rotation);
      } else if (keys['d']) {
        rotation = 0.05 / car.speed;
        if (rotation > 0.05) {
          rotation = 0.05;
        }
        car.rotate(rotation);
      }
  
      car.draw();
      car.crossCheckPoint(track);
  
      requestAnimationFrame(gameLoop);
    };
  
    gameLoop();
  });
  
  
  
  window.addEventListener('keydown', (event) => {
    keys[event.key.toLocaleLowerCase()] = true;
  });
  
  window.addEventListener('keyup', (event) => {
    keys[event.key.toLocaleLowerCase()] = false;
  });
  </script>  