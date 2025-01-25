import React from 'react';
import logo from './logo.svg';
import './App.css';
import cv from "@techstark/opencv-js";

function App() {

  const testImageOnLoad = (imgSrc: any) => {
    console.log('imgSrc', imgSrc)
    cv['onRuntimeInitialized']=()=>{
      const img = cv.imread(imgSrc);
      processImage(img);
    }
  }

  const appendImage = (img: cv.Mat) => {
    const canvasContainer = document.getElementById('canvasContainer');
    const image0 = document.createElement("canvas");
    cv.imshow(image0, img);
    canvasContainer!.appendChild(image0);
  }

  const processImage = async (img: cv.Mat) => {
    const canvasContainer = document.getElementById('canvasContainer');
    canvasContainer!.innerHTML = '';
    appendImage(img);

    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const threshold = new cv.Mat();
    const edges = new cv.Mat();

    // Step 1: Convert to grayscale
    cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY, 0);
    appendImage(gray);

    // Step 2: Reduce noise
    cv.GaussianBlur(gray, blurred, new cv.Size(0, 0), 4, 4);
    appendImage(blurred);

    // cv.threshold(blurred, threshold, 120, 255, cv.THRESH_BINARY);
    // appendImage(threshold);

    // // Step 3: Detect edges
    // cv.Canny(blurred, edges, 50, 150);
    // appendImage(edges);

    // Detect circles or ellipses
    const circles = new cv.Mat();
    const dp = 1;             // Inverse ratio of resolution
    const minDist = 1;       // Minimum distance between circle centers
    const param1 = 150;       // Higher threshold for Canny edge detection
    const param2 = 50;        // Accumulator threshold for circle detection
    const minRadius = 300;     // Minimum circle radius
    const maxRadius = 3000;    // Maximum circle radius
    cv.HoughCircles(blurred, circles, cv.HOUGH_GRADIENT, dp, minDist, param1, param2, minRadius, maxRadius);
    // Step 5: Draw detected circles
    console.log('circles', circles);
    let biggestRadius = 0;
    const allX = [];
    const allY = [];
    for (let i = 0; i < circles.cols; i++) {
      const [x, y, radius] = circles.data32F.slice(i * 3, i * 3 + 3);
      biggestRadius = Math.max(biggestRadius, radius);
      allX.push(x);
      allY.push(y);
      const center = new cv.Point(x, y);
      cv.circle(blurred, center, radius, [255, 0, 0, 255], 3); // Draw circle
      cv.circle(blurred, center, 2, [0, 255, 0, 255], 3);     // Draw center
    }
    appendImage(blurred)

    allX.sort();
    allY.sort();
    const medianX = allX[Math.floor(allX.length / 2)];
    const medianY = allY[Math.floor(allY.length / 2)];
    const rect = new cv.Rect(
      medianX - biggestRadius,
      medianY - biggestRadius,
      biggestRadius * 2,
      biggestRadius * 2
    );
    console.log('medianX', medianX);
    console.log('medianY', medianY);
    console.log('biggestRadius', biggestRadius);

    const cropped = img.roi(rect);
    appendImage(cropped)
    
  };

  const submitImage = async (event: any) => {
    console.log('submitImage');
    const file = event.target.files[0]; // Get the first file

    if (file) {
      // processImage(cv.imread(arrayBuffer));
      // const img = new Image();
      // img.src = URL.createObjectURL(file);
      // img.onload = () => processImage(cv.imread(img));
    }
  };

  return (
    <div className="App">
      {
        <img
          id="testImage"
          src={'/test/test1.jpg'}
          alt="Image"
          style={{ display:'none' }}
          onLoad={(e) => {
            testImageOnLoad(e.target);
          }}
        />
      }
      <div id="canvasContainer" style={{ width: 200, display: 'flex', flexWrap: 'wrap' }} />
    </div>
  );
}

export default App;
