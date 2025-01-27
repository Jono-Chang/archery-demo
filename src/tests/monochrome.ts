import cv from "@techstark/opencv-js";
import { appendImage } from "../helper/appendImage";

const removeSmallBlobs = (mask: cv.Mat, minArea: number) => {
    // Find contours in the binary mask
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  
    // Create a new mask to store the filtered result
    let filteredMask = cv.Mat.zeros(mask.rows, mask.cols, mask.type());
  
    // Loop through each contour and keep only large ones
    for (let i = 0; i < contours.size(); i++) {
      let contour = contours.get(i);
      let area = cv.contourArea(contour);
      if (area > minArea) {
        // Draw the contour on the new mask
        cv.drawContours(filteredMask, contours, i, new cv.Scalar(255, 255, 255, 255), -1); // Fill the contour
      }
      contour.delete();
    }
  
    // Clean up
    contours.delete();
    hierarchy.delete();
  
    return filteredMask;
  }

function fillSmallHoles(mask: cv.Mat, kernelSize: number) {
    // Create a structuring element (kernel)
    let kernel = cv.Mat.ones(kernelSize, kernelSize, cv.CV_8U);

    // Perform morphological opening
    let openedMask = new cv.Mat();
    cv.morphologyEx(mask, openedMask, cv.MORPH_OPEN, kernel);

    // Clean up
    kernel.delete();

    return openedMask;
}

export const monochrome = (src: cv.Mat) => {
    appendImage(src);

    
    
    // Apply Gaussian Blur
    const blurred = new cv.Mat();
    cv.GaussianBlur(src, blurred, new cv.Size(0, 0), 5);
    appendImage(blurred);

    // Convert the src to HSV color space
    let hsv = new cv.Mat();
    cv.cvtColor(blurred, hsv, cv.COLOR_BGR2Luv);

    // Define the range for light blue in HSV
    const lowerBlue = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [70, 80, 100, 0]); // Lower bound
    const upperBlue = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [200, 200, 160, 0]); // Upper bound

    // Create a mask for light blue
    let mask = new cv.Mat();
    cv.inRange(hsv, lowerBlue, upperBlue, mask);
    appendImage(mask);

    const newMask = fillSmallHoles(mask, 40);
    appendImage(newMask);

    const blur2 = new cv.Mat();
    cv.GaussianBlur(newMask, blur2, new cv.Size(0, 0), 4);

    let mask2 = new cv.Mat();
    mask2 = removeSmallBlobs(blur2, 1000);
    appendImage(mask2);

    // Filter the light blue parts from the src
    let result = new cv.Mat();
    cv.bitwise_and(src, src, result, mask2);

    appendImage(result);

    // Clean up
    hsv.delete();
    lowerBlue.delete();
    upperBlue.delete();
    mask.delete();

    // Return the filtered src
    return result;
}