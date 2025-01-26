import cv from "@techstark/opencv-js";
import { appendImage } from "../helper/appendImage";
import Tesseract from "tesseract.js";

export const pointRings = async (src: cv.Mat) => {
    appendImage(src);

     // Preprocess the image
     const gray = new cv.Mat();
     cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

     // Threshold the image
     const binary = new cv.Mat();
     cv.threshold(gray, binary, 100, 255, cv.THRESH_BINARY_INV);
     appendImage(binary)

     // Find contours
     const contours = new cv.MatVector();
     const hierarchy = new cv.Mat();
     cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
     

     // Loop through contours and filter potential digits
     for (let i = 0; i < contours.size(); i++) {
       const contour = contours.get(i);
       const rect = cv.boundingRect(contour);
       const aspectRatio = rect.width / rect.height;

       // Filter based on size and aspect ratio
       if (rect.height > 20 && rect.width > 10 && aspectRatio < 1) {
         // Extract ROI (Region of Interest)
         const roi = binary.roi(rect);

         // Convert ROI to a canvas for OCR
         const roiCanvas = document.createElement('canvas');
         roiCanvas.width = rect.width;
         roiCanvas.height = rect.height;
         const roiCtx = roiCanvas.getContext('2d');
         const roiImg = new ImageData(new Uint8ClampedArray(4 * rect.width * rect.height), rect.width, rect.height);
         roiCtx!.putImageData(roiImg, 0, 0);

         // Use Tesseract.js for OCR
         const text = await Tesseract.recognize(roiCanvas, 'eng', {
           logger: (m) => console.log(m),
         });
         const detectedText = text.data.text.trim();
         console.log('detectedText', detectedText)

         // Check if the detected text is a number between 1 and 10
         if (/^[1-9]$|^10$/.test(detectedText)) {
           console.log(`Detected number: ${detectedText}`);
           // Draw a rectangle around the detected number
           cv.rectangle(src, new cv.Point(rect.x, rect.y), new cv.Point(rect.x + rect.width, rect.y + rect.height), [0, 255, 0, 255], 2);
         }

         roi.delete();
       }
     }

     // Display the result
     appendImage(src)
}