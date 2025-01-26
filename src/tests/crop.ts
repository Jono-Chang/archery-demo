
import cv from "@techstark/opencv-js";
import { appendImage } from "../helper/appendImage";

export const crop = (img: cv.Mat) => {
    appendImage(img);

    const gray = new cv.Mat();
    const blurred = new cv.Mat();

    // Step 1: Convert to grayscale
    cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY, 0);
    appendImage(gray);

    // Step 2: Reduce noise
    cv.GaussianBlur(gray, blurred, new cv.Size(0, 0), 4, 4);
    appendImage(blurred);

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
    
}