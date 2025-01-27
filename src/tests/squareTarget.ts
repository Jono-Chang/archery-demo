
import cv from "@techstark/opencv-js";
import { appendImage } from "../helper/appendImage";
import { monochrome } from "./monochrome";

const REFERENCE_CIRCLE_SCALING = 0.7;
const OUTER_CIRCLE_SCALING = 1.29;

const ARROW_MIN_DISTANCE = 10;

const calculatePerimeterAndArea = (contour: cv.Mat) => {
    // Calculate perimeter (arc length)
    // const perimeter = cv.arcLength(contour, true);
    const rect = cv.boundingRect(contour);
    const perimeter = (rect.width + rect.height) * 2;

    // Calculate area
    const area = cv.contourArea(contour);

    return { perimeter, area };
}

const isCloseToHorizontalOrVertical = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1); // Difference in x
    const dy = Math.abs(y2 - y1); // Difference in y

    // Define a threshold to determine "closeness" (adjust as needed)
    const threshold = 0.3;

    if (dy === 0 || dx / dy < threshold) {
        return "Close to horizontal";
    } else if (dx === 0 || dy / dx < threshold) {
        return "Close to vertical";
    } else {
        return "Neither close to horizontal nor vertical";
    }
}

type BasicLine = { x1: number, y1: number, x2: number, y2: number };

const calculateAverage = (lines: Array<BasicLine>) => {
    let totalX1 = 0, totalY1 = 0, totalX2 = 0, totalY2 = 0;

    // Sum all x1, y1, x2, y2 values
    lines.forEach(line => {
        totalX1 += line.x1;
        totalY1 += line.y1;
        totalX2 += line.x2;
        totalY2 += line.y2;
    });

    // Calculate averages
    const x1 = totalX1 / lines.length;
    const y1 = totalY1 / lines.length;
    const x2 = totalX2 / lines.length;
    const y2 = totalY2 / lines.length;

    return { x1, y1, x2, y2 };
}

const calculateClosestLine = (point: { x: number, y: number }, lines: Array<BasicLine>): BasicLine | null => {
    const { x: x0, y: y0 } = point;

    let closestLine: BasicLine | null = null;
    let minDistance = Infinity;

    lines.forEach(line => {
        const { x1, y1, x2, y2 } = line;

        // Calculate the perpendicular distance from the point to the line
        const numerator = Math.abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1);
        const denominator = Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);
        const distance = numerator / denominator;

        // Update the closest line if this distance is smaller
        if (distance < minDistance) {
            minDistance = distance;
            closestLine = line;
        }
    });

    return closestLine as BasicLine | null;
}

const findIntersection = (line1: BasicLine, line2: BasicLine) => {
    // Line 1 coefficients
    const A1 = line1.y2 - line1.y1;
    const B1 = line1.x1 - line1.x2;
    const C1 = line1.x2 * line1.y1 - line1.x1 * line1.y2;

    // Line 2 coefficients
    const A2 = line2.y2 - line2.y1;
    const B2 = line2.x1 - line2.x2;
    const C2 = line2.x2 * line2.y1 - line2.x1 * line2.y2;

    // Calculate the determinant
    const determinant = A1 * B2 - A2 * B1;

    if (determinant === 0) {
        // Lines are parallel (no intersection or infinitely many if coincident)
        return null;
    }

    // Intersection point
    const x = Math.abs((B2 * C1 - B1 * C2) / determinant);
    const y = Math.abs((A1 * C2 - A2 * C1) / determinant);

    return { x, y };
}

const findFarthestPoint = (A: { x: number, y: number }, B: BasicLine) => {
    const { x, y } = A;
    const { x1, y1, x2, y2 } = B;

    // Calculate distances
    const distanceToFirstPoint = Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2);
    const distanceToSecondPoint = Math.sqrt((x2 - x) ** 2 + (y2 - y) ** 2);

    // Compare distances
    if (distanceToFirstPoint > distanceToSecondPoint) {
        return { x: x1, y: y1, distance: distanceToFirstPoint };
    } else {
        return { x: x2, y: y2, distance: distanceToSecondPoint };
    }
}

const numbersAreClose = (a: number, b: number, epsilon: number = 0.01) => {
    return Math.abs(a - b) < epsilon;
}

const distanceBetweenPoints = (p1: cv.Point, p2: cv.Point) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}
const removeOutliers = (data: number[]) => {
    // Sort the array
    const sorted = [...data].sort((a, b) => a - b);
    
    // Find the first quartile (Q1) and third quartile (Q3)
    const q1 = sorted[Math.floor((sorted.length / 4))];
    const q3 = sorted[Math.ceil((sorted.length * 3) / 4 - 1)];
    
    // Calculate the interquartile range (IQR)
    const iqr = q3 - q1;
    
    // Define the bounds for outliers
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    // Filter the data to exclude outliers
    return data.filter(value => value >= lowerBound && value <= upperBound);
  }

const fitToMiddleSquare = (src: cv.Mat) => {
    const { width: imageWidth, height: imageHeight } = src.size();
    const midPoint = { x: imageWidth / 2, y: imageHeight / 2 };

    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const filtered = new cv.Mat();
    const edges = new cv.Mat();
    const morphed = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    // const mono = monochrome(src);

    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Apply Gaussian Blur
    cv.GaussianBlur(gray, blurred, new cv.Size(0, 0), 5);
    
    const sharpened = new cv.Mat();
    cv.addWeighted(gray, 2, blurred, -2,0, sharpened);
    appendImage(sharpened, 'sharpen');


    // Apply Gaussian Blur
    const blur2 = new cv.Mat();
    cv.GaussianBlur(sharpened, blur2, new cv.Size(0, 0), 8);
    appendImage(blur2, 'blur2');

    // Apply Canny edge detection
    
    cv.Canny(blur2, edges, 100, 150, 5, true);
    appendImage(edges, 'Canny');

    
    // Apply Morphological Transformations to close gaps
    const kernel = cv.getStructuringElement(cv.MORPH_ERODE, new cv.Size(10, 10));
    cv.morphologyEx(edges, morphed, cv.MORPH_CROSS, kernel);
    appendImage(morphed, 'morphed');

    const lines = new cv.Mat();
    cv.HoughLinesP(morphed, lines, 1, Math.PI / 180, 10, 400, 20);

    // Draw the detected lines on the original image
    const horizontalLines: Array<BasicLine> = [];
    const verticalLines: Array<BasicLine> = [];
    const annotated = src.clone();
    for (let i = 0; i < lines.rows; i++) {
      const [x1, y1, x2, y2] = lines.data32S.slice(i * 4, (i + 1) * 4);
      const closeTo = isCloseToHorizontalOrVertical(x1, y1, x2, y2);
      if (closeTo === 'Close to horizontal') {
        horizontalLines.push({ x1, y1, x2, y2 })
        cv.line(annotated, new cv.Point(x1, y1), new cv.Point(x2, y2), [0, 255, 0, 255], 2)
      } else if (closeTo === 'Close to vertical') {
        verticalLines.push({ x1, y1, x2, y2 })
        cv.line(annotated, new cv.Point(x1, y1), new cv.Point(x2, y2), [255, 0, 0, 255], 2)
      } else {
        cv.line(annotated, new cv.Point(x1, y1), new cv.Point(x2, y2), [255, 255, 255, 255], 2)
      }
    }

    const averageHorizontal = calculateClosestLine(midPoint, horizontalLines);
    if (!averageHorizontal) return null;
    cv.line(
        annotated,
        new cv.Point(averageHorizontal.x1, averageHorizontal.y1),
        new cv.Point(averageHorizontal.x2, averageHorizontal.y2),
        [0, 0, 0, 255],
        2
    )

    const averageVertical = calculateClosestLine(midPoint, verticalLines);
    if (!averageVertical) return null;
    cv.line(
        annotated,
        new cv.Point(averageVertical.x1, averageVertical.y1),
        new cv.Point(averageVertical.x2, averageVertical.y2),
        [0, 0, 0, 255],
        2
    )

    const intersection = findIntersection(averageHorizontal, averageVertical);
    console.log('intersection', averageHorizontal, averageVertical, intersection)
    if (!intersection) return null;
    cv.circle(annotated, new cv.Point(intersection.x, intersection.y), 5, [255, 0, 255, 255]);
    appendImage(annotated, 'annotated');

    const furthertHorizontal = findFarthestPoint(intersection, averageHorizontal);
    console.log('intersection', intersection)
    console.log('averageHorizontal', averageHorizontal)
    console.log('furthertHorizontal', furthertHorizontal)
    const furthertVertical = findFarthestPoint(intersection, averageVertical);
    console.log([
        Math.round(intersection.x), Math.round(intersection.y),
        Math.round(furthertHorizontal.x), Math.round(furthertHorizontal.y),
        Math.round(furthertVertical.x), Math.round(furthertHorizontal.y),
        Math.round(furthertVertical.x), Math.round(furthertVertical.y),
    ])
    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        Math.round(intersection.x), Math.round(intersection.y),
        Math.round(furthertHorizontal.x), Math.round(furthertHorizontal.y),
        Math.round(furthertVertical.x), Math.round(furthertHorizontal.y),
        Math.round(furthertVertical.x), Math.round(furthertVertical.y),
    ]);
    const radius = Math.min(imageWidth, imageHeight) / 2 * 0.9;
    // Define destination points for perspective transform
    console.log([
        midPoint.x - radius, midPoint.y + radius,
        midPoint.x - radius, midPoint.y - radius,
        midPoint.x + radius, midPoint.y - radius,
        midPoint.x + radius, midPoint.y + radius,
    ])
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        midPoint.x - radius, midPoint.y + radius,
        midPoint.x - radius, midPoint.y - radius,
        midPoint.x + radius, midPoint.y - radius,
        midPoint.x + radius, midPoint.y + radius,
    ]);

    // // Apply perspective transform
    const transform = cv.getPerspectiveTransform(srcPts, dstPts);
    const dst = src.clone();
    cv.warpPerspective(src, dst, transform, src.size());

    
    appendImage(edges);
    appendImage(morphed);
    appendImage(dst, 'transformed');

    return { dst, perspective: averageHorizontal.y1 < averageHorizontal.y2 ? 'right' : 'left' }

    // // If a valid quadrilateral is found, isolate and warp it
    // if (!largestQuad) return;

    // const points = [];
    // for (let i = 0; i < largestQuad.rows; i++) {
    //     const point = largestQuad.data32S.slice(i * 2, i * 2 + 2);
    //     points.push({ x: point[0], y: point[1] });
    // }

    // // Sort points (top-left, top-right, bottom-right, bottom-left)
    // points.sort((a, b) => a.y - b.y);
    // const [topLeft, topRight] = points.slice(0, 2).sort((a, b) => a.x - b.x);
    // const [bottomLeft, bottomRight] = points.slice(2).sort((a, b) => a.x - b.x);

    // const leftHeight = Math.abs(topLeft.y - bottomLeft.y);
    // const rightHeight = Math.abs(topRight.y - bottomRight.y);
    // const perspective = leftHeight > rightHeight ? 'left' : 'right';

    // // Define destination points for perspective transform
    // const width = Math.max(
    //     Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y),
    //     Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y)
    // );
    // const height = Math.max(
    //     Math.hypot(topLeft.x - bottomLeft.x, topLeft.y - bottomLeft.y),
    //     Math.hypot(topRight.x - bottomRight.x, topRight.y - bottomRight.y)
    // );

    // const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    //     topLeft.x, topLeft.y,
    //     topRight.x, topRight.y,
    //     bottomRight.x, bottomRight.y,
    //     bottomLeft.x, bottomLeft.y
    // ]);
    // const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    //     0, 0,
    //     width - 1, 0,
    //     width - 1, height - 1,
    //     0, height - 1
    // ]);

    // // Apply perspective transform
    // const transform = cv.getPerspectiveTransform(srcPts, dstPts);
    // const dst = new cv.Mat();
    // cv.warpPerspective(src, dst, transform, new cv.Size(width, height));

    // // Display the result
    // // appendImage(dst);


    // // Clean up
    // srcPts.delete();
    // dstPts.delete();
    // transform.delete();
    // return { dst, perspective };
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

    const blurred = gray;
    cv.GaussianBlur(blurred, gray, new cv.Size(0, 0), 1.1);

    // 4. Detect edges using Canny edge detector
    let edges = new cv.Mat();
    cv.Canny(blurred, edges, 50, 100);
    
    // Apply Morphological Transformations to close gaps
    let morphed = new cv.Mat();
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(4, 4));
    cv.morphologyEx(edges, morphed, cv.MORPH_CLOSE, kernel);

    // 5. Detect lines using HoughLinesP (Probabilistic Hough Line Transform)
    let lines = new cv.Mat();
    cv.HoughLinesP(morphed, lines, 1, Math.PI / 180, 100, 150, 10);  // Parameters for short lines

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
        lineStore.push([targetPoint, tailPoint]);
    }

    // Remove length outliers
    const lengths = lineStore.map(([p1, p2]) => distanceBetweenPoints(p1, p2));
    const nonOutlierLengths = removeOutliers(lengths);
    const filteredLineStore = lineStore//.filter((_, i) => nonOutlierLengths.includes(lengths[i]));

    // Draw the detected lines on the original image
    for (let i = 0; i < filteredLineStore.length; i++) {
        const [targetPoint, tailPoint] = filteredLineStore[i];
        cv.line(clone, targetPoint, tailPoint, new cv.Scalar(255, 255, 255), 1, cv.LINE_AA);
        cv.circle(clone, targetPoint, 1, new cv.Scalar(0, 255, 0), -1);
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
        points: filteredLineStore.map(([p1, p2]) => (p1)),
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