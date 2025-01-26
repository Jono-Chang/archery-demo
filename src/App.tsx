import React from 'react';
import logo from './logo.svg';
import './App.css';
import cv from "@techstark/opencv-js";
import { crop } from './tests/crop';
import { pointRings } from './tests/pointRings';
import { squareTarget } from './tests/squareTarget';
import { monochrome } from './tests/monochrome';

function App() {

  const testImageOnLoad = (imgSrc: any) => {
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
    // crop(img);
    // pointRings(img);
    squareTarget(img);
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
          src={'/test/test6.jpg'}
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
