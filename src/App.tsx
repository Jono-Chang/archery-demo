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

  const processImage = async (img: cv.Mat) => {
    const canvasContainer = document.getElementById('canvasContainer');
    canvasContainer!.innerHTML = '';
    const image0 = document.createElement("canvas");
    cv.imshow(image0, img);
    canvasContainer!.appendChild(image0);
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
      <div id="canvasContainer" style={{ width: 200, display: 'flex' }} />
    </div>
  );
}

export default App;
