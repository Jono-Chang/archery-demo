
import cv from "@techstark/opencv-js";
import { appendImage } from "../helper/appendImage";

export const blackCircle = (src: cv.Mat) => {
    const { width, height } = src.size();
    appendImage(src);

    const gray = new cv.Mat();

    // Step 1: Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    appendImage(gray);
    
    // Threshold the image
    const averageColor = cv.mean(gray)[0];
    console.log('averageColor', averageColor)
    const binary = new cv.Mat();
    cv.threshold(gray, binary, averageColor, 255, cv.THRESH_BINARY_INV);
    appendImage(binary)

    // Step 2: Reduce noise
    const blurred = new cv.Mat();
    cv.GaussianBlur(binary, blurred, new cv.Size(0, 0), 13);
    appendImage(blurred, 'blurred');

    // Threshold the image again
    const binary2 = new cv.Mat();
    cv.threshold(blurred, binary2, averageColor, 255, cv.THRESH_BINARY);
    appendImage(binary2)

    // Find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(binary2, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Get image center
    let centerX = width / 2;
    let centerY = height / 2;

    let minDist = Infinity;
    let closestContourIndex = -1;

    const contourVisualisation = new cv.Mat();
    cv.cvtColor(binary, contourVisualisation, cv.COLOR_GRAY2RGBA);
    // Iterate through contours to find the closest to the center
    for (let i = 0; i < contours.size(); i++) {
        const countour = contours.get(i);
        let moments = cv.moments(countour);
        if (moments.m00 !== 0) {
            let cx = moments.m10 / moments.m00; // Centroid x
            let cy = moments.m01 / moments.m00; // Centroid y
            cv.circle(contourVisualisation, new cv.Point(cx, cy), 5, new cv.Scalar(0, 0, 255, 255), -1);
            cv.drawContours(contourVisualisation, contours, i, new cv.Scalar(255, 0, 0, 255), 2, cv.LINE_AA);
            let dist = Math.sqrt((cx - centerX) ** 2 + (cy - centerY) ** 2);
            if (dist < minDist) {
                minDist = dist;
                closestContourIndex = i;
            }
        }
    }

    appendImage(contourVisualisation, `contourVisualisation (${contours.size()})`);

    // Create a blank mask
    let mask = src.clone();

    // Draw the closest contour on the mask
    if (closestContourIndex !== -1) {
        cv.drawContours(mask, contours, closestContourIndex, new cv.Scalar(255, 255, 255, 255), -1);
    }
    
    
    // const fittedEllipse = cv.fitEllipse(contours.get(closestContourIndex));
    
    appendImage(mask)
}