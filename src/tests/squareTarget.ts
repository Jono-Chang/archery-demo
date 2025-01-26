
import cv from "@techstark/opencv-js";
import { appendImage } from "../helper/appendImage";

const REFERENCE_CIRCLE_SCALING = 0.7;
const OUTER_CIRCLE_SCALING = 1.29;

const ARROW_MIN_DISTANCE = 10;

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

const distanceBetweenPoints = (p1: cv.Point, p2: cv.Point) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
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
    cv.GaussianBlur(gray, blurred, new cv.Size(7, 7), 0);

    // Apply Canny edge detection
    cv.Canny(blurred, edges, 50, 150);

    // Apply Morphological Transformations to close gaps
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(10, 10));
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
            const color = new cv.Scalar(
                Math.round(Math.random() * 255),
                Math.round(Math.random() * 255),
                Math.round(Math.random() * 255),
                255
            );
            cv.drawContours(visual, contours, i, color, 2, cv.LINE_AA);
            if (!isRoughlySquare) continue;

            const { width: imageWidth, height: imageHeight } = src.size();
            const centerX = imageWidth / 2;
            const centerY = imageHeight / 2;
            const isCenterInside = cv.pointPolygonTest(contour, { x: centerX, y: centerY }, false) >= 0;
            if (!isCenterInside) continue;

            // Draw the quadrilateral on the visual canvas
            const color2 = new cv.Scalar(
                255,
                255,
                255,
                255
            );
            cv.drawContours(visual, contours, i, color2, 2, cv.LINE_AA);

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
    appendImage(gray);
    appendImage(blurred);
    appendImage(edges);
    appendImage(morphed);
    appendImage(visual);

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

    const leftHeight = Math.abs(topLeft.y - bottomLeft.y);
    const rightHeight = Math.abs(topRight.y - bottomRight.y);
    const perspective = leftHeight > rightHeight ? 'left' : 'right';

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
    return { dst, perspective };
}

const calculateArcAngles = (ellipse: cv.RotatedRect) => {
    const center = ellipse.center;
    console.log('ellipse', ellipse)
    const { width, height } = ellipse.size;
    const angle = ellipse.angle; // Rotation of the ellipse in degrees

    // To compute angles, we need to find the points on the ellipse
    // For simplicity, let's assume we are looking at two specific points on the ellipse.

    // Convert the angle of the ellipse to radians
    const angleRad = angle * Math.PI / 180;

    // Calculate the points for the start and end of the arc (for example, on the major axis)
    const startPoint = new cv.Point(
        center.x + width * Math.cos(angleRad),
        center.y + height * Math.sin(angleRad)
    );
    const endPoint = new cv.Point(
        center.x - width * Math.cos(angleRad),
        center.y - height * Math.sin(angleRad)
    );

    // Now calculate the angle from the center to the points
    const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x) * 180 / Math.PI;
    const endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x) * 180 / Math.PI;

    // Normalize angles to be in the range [0, 360)
    const normalizedStartAngle = (startAngle + 360) % 360;
    const normalizedEndAngle = (endAngle + 360) % 360;

    return { startAngle: normalizedStartAngle, endAngle: normalizedEndAngle };
}

const fitToMiddleCircle = (src: cv.Mat) => {
    const { width: imageWidth, height: imageHeight } = src.size();
    const centerX = imageWidth / 2;
    const centerY = imageHeight / 2;

    // Step 1: Convert to grayscale
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Step 2: Apply Gaussian blur to reduce noise
    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    const contrasted = new cv.Mat();
    cv.threshold(blurred, contrasted, 50, 255, cv.THRESH_BINARY);

    // Step 3: Apply edge detection (Canny)
    const edges = new cv.Mat();
    cv.Canny(contrasted, edges, 200, 2);

    const morphed = new cv.Mat();
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.morphologyEx(edges, morphed, cv.MORPH_CLOSE, kernel);

    // Step 4: Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Step 5: Iterate through the contours and fit ellipses
    let largestContour: cv.Mat | null = null;
    let largestArea = 0;
    for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);

        const { area } = calculatePerimeterAndArea(contour)
        const isCenterInside = cv.pointPolygonTest(contour, { x: centerX, y: centerY }, false) >= 0;
        // cv.circle(src, new cv.Point(centerX, centerY), 5, new cv.Scalar(0, 0, 255, 255), -1);
        // cv.drawContours(src, contours, i, new cv.Scalar(255, 0, 0, 255), 2, cv.LINE_AA);
        if (!isCenterInside) continue;

        // cv.drawContours(src, contours, i, new cv.Scalar(255, 255, 0, 255), 2, cv.LINE_AA);

        if (area > largestArea) {
            largestArea = area;
            largestContour = contour.clone();
        }
    }

    if (!largestContour) return;

    const fittedEllipse = cv.fitEllipse(largestContour);
    // cv.ellipse(
    //     src, // Input/output image
    //     fittedEllipse.center, // Center coordinates
    //     new cv.Size(fittedEllipse.size.width / 2, fittedEllipse.size.height / 2), // Radii of the ellipse
    //     fittedEllipse.angle, // Rotation angle 
    //     fittedEllipse.angle - 180, // Starting angle (0 degrees)
    //     fittedEllipse.angle + 180, // Ending angle (360 degrees)
    //     new cv.Scalar(0, 0, 255), // Color of the ellipse (red)
    //     2, // Thickness of the ellipse outline
    //     cv.LINE_AA // Line type (anti-aliased)
    // );

    // appendImage(gray);
    // appendImage(blurred);
    // appendImage(contrasted);
    // appendImage(edges);
    // appendImage(morphed);
    // appendImage(src);

    const ellipseRadiusX = fittedEllipse.size.width / 2;
    const ellipseRadiusY = fittedEllipse.size.height / 2;
    const ellipseCenterX = fittedEllipse.center.x;
    const ellipseCenterY = fittedEllipse.center.y;
    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        ellipseCenterX - ellipseRadiusX, ellipseCenterY,  // left
        ellipseCenterX + ellipseRadiusX, ellipseCenterY,  // right
        ellipseCenterX, ellipseCenterY - ellipseRadiusY,  // top
        centerX, ellipseCenterY + ellipseRadiusY   // bottom
    ]);

    const radius = src.size().width / 2 * REFERENCE_CIRCLE_SCALING;
    // Define destination points for perspective transform
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        // You would map those points to form a circle
        centerX - radius, centerY,  // left
        centerX + radius, centerY,  // right
        centerX, centerY - radius,  // top
        centerX, centerY + radius   // bottom
    ]);

    // Apply perspective transform
    const transform = cv.getPerspectiveTransform(srcPts, dstPts);
    const dst = new cv.Mat();
    cv.warpPerspective(src, dst, transform, src.size());
    appendImage(dst);
    return dst;
}

const drawInnerCircle = (src: cv.Mat, radius: number, color: cv.Scalar = new cv.Scalar(255, 0, 0, 255)) => {
    // Example usage
    // const referenceRadius = dst2.size().width / 2 * REFERENCE_CIRCLE_SCALING;
    // drawInnerCircle(dst2, referenceRadius * 0.25, new cv.Scalar(255, 255, 0, 255));
    // drawInnerCircle(dst2, referenceRadius * 0.5, new cv.Scalar(255, 0, 0, 255));
    // drawInnerCircle(dst2, referenceRadius * 0.74, new cv.Scalar(0, 0, 255, 255));
    // drawInnerCircle(dst2, referenceRadius, new cv.Scalar(0, 0, 0, 255));
    const { width: imageWidth, height: imageHeight } = src.size();
    const centerX = imageWidth / 2;
    const centerY = imageHeight / 2;
    const innerCircleCenterX = centerX;
    const innerCircleCenterY = centerY;
    cv.circle(src, new cv.Point(innerCircleCenterX, innerCircleCenterY), radius, color, 2, cv.LINE_AA);
}

const arrowDetection = (src: cv.Mat, perspective: 'left' | 'right') => {
    const clone = src.clone();

    // 2. Convert to grayscale
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 4. Detect edges using Canny edge detector
    let edges = new cv.Mat();
    cv.Canny(gray, edges, 50, 100);
    
    // Apply Morphological Transformations to close gaps
    let morphed = new cv.Mat();
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
    cv.morphologyEx(edges, morphed, cv.MORPH_CLOSE, kernel);

    // 5. Detect lines using HoughLinesP (Probabilistic Hough Line Transform)
    let lines = new cv.Mat();
    cv.HoughLinesP(morphed, lines, 1, Math.PI / 180, 100, 50, 10);  // Parameters for short lines

    // Draw outer circle
    const outerCircleRadius = src.size().width / 2 * REFERENCE_CIRCLE_SCALING * OUTER_CIRCLE_SCALING;
    const { width: imageWidth, height: imageHeight } = src.size();
    const centerX = imageWidth / 2;
    const centerY = imageHeight / 2;
    const centerPoint = new cv.Point(centerX, centerY);
    cv.circle(clone, centerPoint, outerCircleRadius, new cv.Scalar(255, 255, 255, 255), 2, cv.LINE_AA);

    const lineStore: Array<[cv.Point, cv.Point]> = [];
    // 6. Draw the detected lines on the original image
    for (let i = 0; i < lines.rows; i++) {
        let x1 = lines.data32S[i * 4];
        let y1 = lines.data32S[i * 4 + 1];
        let x2 = lines.data32S[i * 4 + 2];
        let y2 = lines.data32S[i * 4 + 3];

        const targetPoint = perspective === 'left' ? new cv.Point(x1, y1) : new cv.Point(x2, y2);
        const tailPoint = perspective === 'left' ? new cv.Point(x2, y2) : new cv.Point(x1, y1);

        if (lineStore.some(
            ([p1, p2]) => distanceBetweenPoints(targetPoint, p1) < ARROW_MIN_DISTANCE
              || distanceBetweenPoints(tailPoint, p2) < ARROW_MIN_DISTANCE
        )) {
            continue;
        }
        
        const distanceFromCenter = distanceBetweenPoints(targetPoint, new cv.Point(centerX, centerY));
        if (distanceFromCenter > outerCircleRadius) continue;

        cv.line(clone, new cv.Point(x1, y1), new cv.Point(x2, y2), new cv.Scalar(255, 0, 0), 1, cv.LINE_AA);
        cv.circle(clone, targetPoint, 1, new cv.Scalar(255, 0, 0), -1);
        
        lineStore.push([targetPoint, tailPoint]);
    }

    // 7. Show the result
    appendImage(src);
    appendImage(gray);
    appendImage(edges);
    appendImage(morphed);
    appendImage(clone);

    // 8. Cleanup
    gray.delete();
    // blurred.delete();
    edges.delete();
    lines.delete();

    return {
        dst: clone,
        points: lineStore.map(([p1, p2]) => (p1)),
        centerPoint
    };
}

export const calculateResults = (src: cv.Mat, points: cv.Point[], centerPoint: cv.Point) => {
    const smallestRadius = src.size().width / 2 * 0.07;
    const outerCircleRadius = src.size().width / 2;
    const increment = (outerCircleRadius - smallestRadius) / 9;
    const results: number[] = [];
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const distanceFromCenter = distanceBetweenPoints(point, centerPoint);
        if (distanceFromCenter < smallestRadius) {
            results.push(10);
            continue;
        }
        results.push(10 - Math.ceil((distanceFromCenter - smallestRadius) / increment));
    }

    const clone = src.clone();
    for (let i = 0; i < points.length; i++) {
        cv.putText(clone, `${results[i]}`, points[i], cv.FONT_HERSHEY_SIMPLEX, 0.5, new cv.Scalar(255, 255, 255), 1);
    }

    return { dst: clone, results}
}

export const squareTarget = (src: cv.Mat) => {
    appendImage(src);
    const { dst: dst1, perspective: perspective1 } = fitToMiddleSquare(src) || {};   
    if (!dst1) return;
    appendImage(dst1);
    const dst2 = fitToMiddleCircle(dst1);
    if (!dst2) return;
    const { dst: dst3, points, centerPoint } = arrowDetection(dst2, perspective1 as any) || {};
    
    // const clone = dst3.clone();
    // for (let i = 0; i < 9; i++) {
    //     drawInnerCircle(clone, smallestRadius + increment * i, new cv.Scalar(255, 255, 255, 255));
    // }
    // appendImage(clone);

    const { dst: dst4, results } = calculateResults(dst2, points, centerPoint);
    appendImage(dst4);
    console.log(results)
}