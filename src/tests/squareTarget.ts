
import cv from "@techstark/opencv-js";
import { appendImage } from "../helper/appendImage";

const calculatePerimeterAndArea = (contour: cv.Mat) => {
    // Calculate perimeter (arc length)
    const perimeter = cv.arcLength(contour, true);

    // Calculate area
    const area = cv.contourArea(contour);

    return { perimeter, area };
}

const numbersAreClose = (a: number, b: number, epsilon: number = 0.01) => {
    return Math.abs(a - b) < epsilon;
}

const fitToMiddleSquare = (src: cv.Mat) => {
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    const morphed = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Apply Gaussian Blur
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // Apply Canny edge detection
    cv.Canny(blurred, edges, 50, 150);

    // Apply Morphological Transformations to close gaps
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.morphologyEx(edges, morphed, cv.MORPH_CLOSE, kernel);

    // Find contours on the morphed image
    cv.findContours(morphed, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

    // Clone the original image for visualization
    const visual = src.clone();

    // Initialize variables
    let largestQuad = null;
    let largestArea = 0;

    // Loop through all contours
    for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const approx = new cv.Mat();

        // Approximate the contour to simplify it
        cv.approxPolyDP(contour, approx, 0.03 * cv.arcLength(contour, true), true);

        // Check if the contour is a quadrilateral
        if (approx.rows === 4) {
            // Calculate the area of the quadrilateral
            const { perimeter, area } = calculatePerimeterAndArea(contour)
            const areaBasedOnPerimeter = Math.pow(perimeter / 4, 2);
            const isRoughlySquare = numbersAreClose(areaBasedOnPerimeter, area, 100000)
            if (!isRoughlySquare) continue;

            const { width: imageWidth, height: imageHeight } = src.size();
            const centerX = imageWidth / 2;
            const centerY = imageHeight / 2;
            const isCenterInside = cv.pointPolygonTest(contour, { x: centerX, y: centerY }, false) >= 0;
            if (!isCenterInside) continue;

            // Draw the quadrilateral on the visual canvas
            const color = new cv.Scalar(
                Math.round(Math.random() * 255),
                Math.round(Math.random() * 255),
                Math.round(Math.random() * 255),
                255
            );
            cv.drawContours(visual, contours, i, color, 2, cv.LINE_AA);

            // Keep track of the largest quadrilateral (assume it's the target)
            if (isCenterInside && isRoughlySquare && area > largestArea) {
                const color = new cv.Scalar(255, 255, 255, 255); // Blue
                cv.drawContours(visual, contours, i, color, 2, cv.LINE_AA);

                largestArea = area;
                largestQuad = approx.clone();
            }
        }
        approx.delete();
    }

    // Visualize all detected quadrilaterals
    // appendImage(gray);
    // appendImage(blurred);
    // appendImage(edges);
    // appendImage(morphed);
    // appendImage(visual);

    // If a valid quadrilateral is found, isolate and warp it
    if (!largestQuad) return;

    const points = [];
    for (let i = 0; i < largestQuad.rows; i++) {
        const point = largestQuad.data32S.slice(i * 2, i * 2 + 2);
        points.push({ x: point[0], y: point[1] });
    }

    // Sort points (top-left, top-right, bottom-right, bottom-left)
    points.sort((a, b) => a.y - b.y);
    const [topLeft, topRight] = points.slice(0, 2).sort((a, b) => a.x - b.x);
    const [bottomLeft, bottomRight] = points.slice(2).sort((a, b) => a.x - b.x);

    // Define destination points for perspective transform
    const width = Math.max(
        Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y),
        Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y)
    );
    const height = Math.max(
        Math.hypot(topLeft.x - bottomLeft.x, topLeft.y - bottomLeft.y),
        Math.hypot(topRight.x - bottomRight.x, topRight.y - bottomRight.y)
    );

    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        topLeft.x, topLeft.y,
        topRight.x, topRight.y,
        bottomRight.x, bottomRight.y,
        bottomLeft.x, bottomLeft.y
    ]);
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        width - 1, 0,
        width - 1, height - 1,
        0, height - 1
    ]);

    // Apply perspective transform
    const transform = cv.getPerspectiveTransform(srcPts, dstPts);
    const dst = new cv.Mat();
    cv.warpPerspective(src, dst, transform, new cv.Size(width, height));

    // Display the result
    // appendImage(dst);


    // Clean up
    srcPts.delete();
    dstPts.delete();
    transform.delete();
    return dst;
}

const smoothCircularContour = (contour: cv.Mat) => {
    // Step 1: Approximate the contour
  const epsilon = 0.01 * cv.arcLength(contour, true); // Adjust epsilon to control smoothing
  const approx = new cv.Mat();
  cv.approxPolyDP(contour, approx, epsilon, true);

  // Step 2: Fit a minimum enclosing circle
  const center = new cv.Point(0, 0);
  const radius = new cv.Mat();
  cv.fitEllipse(approx);

  // Step 3: Generate a smooth circular contour
  const smoothedContour = new cv.Mat();
  const numPoints = 100; // Number of points for the smooth circle
  const angleStep = (2 * Math.PI) / numPoints;

  for (let i = 0; i < numPoints; i++) {
    const theta = i * angleStep;
    const x = center.x + radius.data64F[0] * Math.cos(theta);
    const y = center.y + radius.data64F[0] * Math.sin(theta);
    smoothedContour.push_back(new cv.Mat([new cv.Point(x, y)]));
  }

  // Cleanup
  approx.delete();
  radius.delete();

  return smoothedContour;
}


const fitToMiddleCircle = (src: cv.Mat) => {
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    const morphed = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Apply Gaussian Blur
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // Apply Canny edge detection
    cv.Canny(blurred, edges, 1, 150);

    // Apply Morphological Transformations to close gaps
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.morphologyEx(edges, morphed, cv.MORPH_CLOSE, kernel);

    // Find contours on the morphed image
    cv.findContours(morphed, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

    // Clone the original image for visualization
    const visual = src.clone();

    // Initialize variables
    let largestQuad = null;
    let largestArea = 0;

    appendImage(gray);
    appendImage(blurred);
    appendImage(edges);
    appendImage(morphed);

    // Loop through all contours
    for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const approx = new cv.Mat();

        // Approximate the contour to simplify it
        cv.approxPolyDP(contour, approx, 0.03 * cv.arcLength(contour, true), true);

        const { perimeter, area } = calculatePerimeterAndArea(contour)
        const areaBasedOnPerimeter = Math.pow(perimeter / 4, 2);

        const { width: imageWidth, height: imageHeight } = src.size();
        const centerX = imageWidth / 2;
        const centerY = imageHeight / 2;
        const isCenterInside = cv.pointPolygonTest(contour, { x: centerX, y: centerY }, false) >= 0;
        if (!isCenterInside) continue;

        // Draw the quadrilateral on the visual canvas
        const color = new cv.Scalar(
            Math.round(Math.random() * 255),
            Math.round(Math.random() * 255),
            Math.round(Math.random() * 255),
            255
        );
        cv.drawContours(visual, contours, i, color, 2, cv.LINE_AA);

        // smoothCircularContour(contour);
        // const color2 = new cv.Scalar(255, 255, 255, 255); // Blue
        // let matVec = new cv.MatVector();
        // const smootheresMat = smoothCircularContour(contours.get(3))
        // matVec.push_back(smootheresMat);
        // cv.drawContours(visual, matVec, 0, color2, 2, cv.LINE_AA);


        // Keep track of the largest quadrilateral (assume it's the target)
        if (isCenterInside && area > largestArea) {
            console.log('test')
            const color = new cv.Scalar(255, 255, 255, 255); // Blue
            cv.drawContours(visual, contours, i, color, 2, cv.LINE_AA);

            largestArea = area;
            largestQuad = approx.clone();
        }
        approx.delete();
    }

    appendImage(visual);
}

export const squareTarget = (src: cv.Mat) => {
    appendImage(src);
    const dst1 = fitToMiddleSquare(src);
    if (!dst1) return;
    appendImage(dst1);
    const dst2 = fitToMiddleCircle(dst1);

}