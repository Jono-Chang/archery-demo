
import cv from "@techstark/opencv-js";
import { appendImage, appendResult } from "../helper/appendImage";

const REFERENCE_CIRCLE_SCALING = 0.7;
const OUTER_CIRCLE_SCALING = 1.29;

const ARROW_MIN_DISTANCE = 10;

function rotateImage(mat: cv.Mat, angle: number, size: number) {
    let center = new cv.Point(mat.cols / 2, mat.rows / 2);
    let rotMat = cv.getRotationMatrix2D(center, angle, 1);
    let dst = new cv.Mat();
    cv.warpAffine(mat, dst, rotMat, new cv.Size(size, size), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0));
    rotMat.delete();
    // Calculate the center region to crop (1/zoomFactor of the original size)
    const zoomFactor = 1.4
    let cropWidth = Math.round(size / zoomFactor);
    let cropHeight = Math.round(size / zoomFactor);
    let startX = Math.round((size - cropWidth) / 2);
    let startY = Math.round((size - cropHeight) / 2);

    // Crop the center region
    let centerRegion = dst.roi(new cv.Rect(startX, startY, cropWidth, cropHeight));
    return centerRegion;
  }

  function createUTemplate(templateWidth = 20) {
  
    // Calculate the template height proportional to the width
    let templateHeight = Math.round(templateWidth);  // Height is 200% of the width
  
    // Create a blank binary image with the specified size
    let uTemplate = cv.Mat.zeros(templateHeight, templateWidth, cv.CV_8UC1);
  
    // Adjustable parameters for the "U" shape
    let thickness = 1.5;
    let armLength = Math.round(templateHeight * 0.5);  // Arm length (70% of the height)
    let armOffset = Math.round(templateWidth * 0.2);   // Distance between the arms (40% of the width)
  
    // Left vertical arm of the "U"
    cv.line(uTemplate, new cv.Point((templateWidth - armOffset) / 2, 0), new cv.Point((templateWidth - armOffset) / 2, armLength), new cv.Scalar(255), thickness);
  
    // Right vertical arm of the "U"
    cv.line(uTemplate, new cv.Point((templateWidth + armOffset) / 2, 0), new cv.Point((templateWidth + armOffset) / 2, armLength), new cv.Scalar(255), thickness);
    
    // Bottom
    cv.line(uTemplate, new cv.Point((templateWidth - armOffset) / 2, armLength + 1), new cv.Point((templateWidth + armOffset) / 2, armLength + 1), new cv.Scalar(255), thickness);
  
    return uTemplate;
  }
  
  

const adjustGamma = (image: cv.Mat, gamma = 0.5) => {
    let lookUpTable = new cv.Mat(1, 256, cv.CV_8U);
    let tableData = lookUpTable.data;
    
    for (let i = 0; i < 256; i++) {
        tableData[i] = Math.pow(i / 255.0, gamma) * 255.0;
    }
    
    let result = new cv.Mat();
    cv.LUT(image, lookUpTable, result);
    lookUpTable.delete();
    return result;
}

const getBrighterInnerEllipse = (insideBlackCircleGray: cv.Mat, regneratedblackEllipseMask: cv.Mat, scalar = 1, invert = true) => {
    const insideBlackCircleAverageColor = cv.mean(insideBlackCircleGray, regneratedblackEllipseMask)[0];
    const blackCircleBinary = new cv.Mat();
    cv.threshold(insideBlackCircleGray, blackCircleBinary, insideBlackCircleAverageColor * scalar, 255, invert ? cv.THRESH_BINARY_INV : cv.THRESH_BINARY);
    // appendImage(blackCircleBinary, 'blackCircleBinary')

    const blackCircleBlurred = new cv.Mat();
    cv.GaussianBlur(blackCircleBinary, blackCircleBlurred, new cv.Size(0, 0), 10);
    // appendImage(blackCircleBlurred, 'blackCircleBlurred');

    const blackCircleBinary2 = new cv.Mat();
    cv.threshold(blackCircleBlurred, blackCircleBinary2, 255/2, 255, cv.THRESH_BINARY_INV);
    // appendImage(blackCircleBinary2)

    let contours2 = new cv.MatVector();
    let hierarchy2 = new cv.Mat();
    cv.findContours(blackCircleBinary2, contours2, hierarchy2, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    return cv.fitEllipse(contours2.get(0));
}

const generateMaskForEllipse = (blackEllipse: cv.RotatedRect, src: cv.Mat) => {
    let blackEllipseMask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);

    // Draw the ellipse on the mask (white color)
    cv.ellipse(
        blackEllipseMask, // Input/output image
        blackEllipse.center, // Center coordinates
        new cv.Size(blackEllipse.size.width / 2, blackEllipse.size.height / 2), // Radii of the ellipse
        blackEllipse.angle, // Rotation angle 
        blackEllipse.angle - 180, // Starting angle (0 degrees)
        blackEllipse.angle + 180, // Ending angle (360 degrees)
        new cv.Scalar(255, 255, 255, 255),
        -1 // Fill the ellipse
    );

    return blackEllipseMask;
}

const extractRed = (insideBlackCircleImage: cv.Mat) => {

    let rgbaChannels = new cv.MatVector();
    cv.split(insideBlackCircleImage, rgbaChannels);

    // Extract the red channel (index 2 in OpenCV)
    let redChannel = rgbaChannels.get(2);
    let hsv = new cv.Mat();
    cv.cvtColor(insideBlackCircleImage, hsv, cv.COLOR_RGB2HSV);
    
    // Define lower and upper bounds for red in HSV
    // Red has two ranges: 0-10 and 170-180 in Hue
    let lowerRed1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 50, 50, 0]);   // Adjust Saturation and Value as needed
    let upperRed1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [10, 255, 255, 0]);
    let lowerRed2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [170, 50, 50, 0]);
    let upperRed2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 255, 0]);
    
    // Create masks for the two red ranges
    let mask1 = new cv.Mat();
    let mask2 = new cv.Mat();
    cv.inRange(hsv, lowerRed1, upperRed1, mask1);
    cv.inRange(hsv, lowerRed2, upperRed2, mask2);
    
    // Combine the two masks
    let redMask = new cv.Mat();
    cv.add(mask1, mask2, redMask);
    
    // Apply the mask to the original image
    let masked = new cv.Mat();
    cv.bitwise_and(insideBlackCircleImage, insideBlackCircleImage, masked, redMask);
    
    let result = new cv.Mat();
    cv.cvtColor(masked, result, cv.COLOR_RGBA2GRAY, 0);
    return result;
}

const getAverageEllipse = (ellipse1: cv.RotatedRect, ellipse2: cv.RotatedRect) => {
    let avgCenterX = (ellipse1.center.x + ellipse2.center.x) / 2;
    let avgCenterY = (ellipse1.center.y + ellipse2.center.y) / 2;

    // Calculate the average size
    let avgWidth = (ellipse1.size.width + ellipse2.size.width) / 2;
    let avgHeight = (ellipse1.size.height + ellipse2.size.height) / 2;

    // Calculate the average angle
    let angle1 = ellipse1.angle;
    let angle2 = ellipse2.angle;

    // Handle angle wrapping (if angles differ by more than 180°)
    if (Math.abs(angle1 - angle2) > 180) {
        if (angle1 > angle2) {
            angle2 += 360;
        } else {
            angle1 += 360;
        }
    }

    // Compute the average angle
    let avgAngle = (angle1 + angle2) / 2;
    avgAngle = angle1; // TODO HACK. THIS GIVES BETTER RESULTS.

    // Normalize the angle back to the range [0, 360)
    avgAngle = avgAngle % 360;
    if (avgAngle < 0) avgAngle += 360;

    // Create the average ellipse as a new RotatedRect
    let avgEllipse = new cv.RotatedRect();
    avgEllipse.center = new cv.Point(avgCenterX, avgCenterY);
    avgEllipse.size = new cv.Size(avgWidth, avgHeight);
    avgEllipse.angle = avgAngle;

    return avgEllipse;
}

const getNextEllipse = (ellipseOuter: cv.RotatedRect, ellipseInner: cv.RotatedRect, direction: 'out' | 'in') => {
    let diffCenterX = ellipseOuter.center.x - ellipseInner.center.x;
    let diffCenterY = ellipseOuter.center.y - ellipseInner.center.y;

    let diffWidth = ellipseOuter.size.width - ellipseInner.size.width;
    let diffHeight = ellipseOuter.size.height - ellipseInner.size.height;

    let diffAngle = ellipseOuter.angle - ellipseInner.angle;

    // Create the average ellipse as a new RotatedRect
    let diffEllipse = new cv.RotatedRect();

    if (direction === 'out') {
        const avgCenterX = ellipseOuter.center.x + diffCenterX; 
        const avgCenterY = ellipseOuter.center.y + diffCenterY;
        const avgWidth = ellipseOuter.size.width + diffWidth;
        const avgHeight = ellipseOuter.size.height + diffHeight;
        const avgAngle = ellipseOuter.angle + diffAngle;

        diffEllipse.center = new cv.Point(avgCenterX, avgCenterY);
        diffEllipse.size = new cv.Size(avgWidth, avgHeight);
        diffEllipse.angle = avgAngle;
    } else {
        const avgCenterX = ellipseInner.center.x - diffCenterX; 
        const avgCenterY = ellipseInner.center.y - diffCenterY;
        const avgWidth = ellipseInner.size.width - diffWidth;
        const avgHeight = ellipseInner.size.height - diffHeight;
        const avgAngle = ellipseInner.angle - diffAngle;

        diffEllipse.center = new cv.Point(avgCenterX, avgCenterY);
        diffEllipse.size = new cv.Size(avgWidth, avgHeight);
        diffEllipse.angle = avgAngle;
    }

    return diffEllipse;
}

const getNextEllipseRecursive = (
    ellipseOuter: cv.RotatedRect,
    ellipseInner: cv.RotatedRect,
    direction: 'out' | 'in',
    count: number
): Array<cv.RotatedRect> => {
    if (count === 0) return [];
    const next = getNextEllipse(ellipseOuter, ellipseInner, direction);
    if (direction === 'out') {
        return [next ,...getNextEllipseRecursive(next, ellipseOuter, direction, count - 1)]
    }
    return [next ,...getNextEllipseRecursive(ellipseInner, next, direction, count - 1)]
}

const drawEllipse = (ellipse: cv.RotatedRect, src: cv.Mat, thickness = 2) => {
    cv.ellipse(
        src, // Input/output image
        ellipse.center, // Center coordinates
        new cv.Size(ellipse.size.width / 2, ellipse.size.height / 2), // Radii of the ellipse
        ellipse.angle, // Rotation angle 
        ellipse.angle - 180, // Starting angle (0 degrees)
        ellipse.angle + 180, // Ending angle (360 degrees)
        new cv.Scalar(255, 0, 0), // Color of the ellipse (red)
        thickness, // Thickness of the ellipse outline
        cv.LINE_AA // Line type (anti-aliased)
    );
    cv.circle(src, new cv.Point(ellipse.center.x, ellipse.center.y), 5, new cv.Scalar(0, 0, 255, 255), -1);
}

const enhanceDarkContrast = (grayMat: cv.Mat) => {
    let clahe = new cv.CLAHE();
    clahe.setClipLimit(50.0);  // Clip limit for CLAHE
    clahe.setTilesGridSize(new cv.Size(2, 2));  // Tiles grid size (smaller tiles for finer details)
    let enhancedMat = new cv.Mat();
    clahe.apply(grayMat, enhancedMat);
    return enhancedMat;
}

export const getEllipses = (src: cv.Mat) => {
    const { width, height } = src.size();
    const smallerSide = Math.min(width, height);
    // appendImage(src);

    const gray = new cv.Mat();

    // Step 1: Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    // appendImage(gray);
    
    // Threshold the image
    const averageColor = cv.mean(gray)[0];
    console.log('averageColor', averageColor)
    const binary = new cv.Mat();
    cv.threshold(gray, binary, averageColor, 255, cv.THRESH_BINARY_INV);
    // appendImage(binary)

    // Step 2: Reduce noise
    const blurred = new cv.Mat();
    cv.GaussianBlur(binary, blurred, new cv.Size(0, 0), 13);
    // appendImage(blurred, 'blurred');

    // Threshold the image again
    const binary2 = new cv.Mat();
    cv.threshold(blurred, binary2, averageColor, 255, cv.THRESH_BINARY);
    // appendImage(binary2)

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
    // appendImage(contourVisualisation, `contourVisualisation (${contours.size()})`);

    let ellipseVisualisation = src.clone();
    
    const blackEllipse = cv.fitEllipse(contours.get(closestContourIndex));
    cv.ellipse(
        ellipseVisualisation, // Input/output image
        blackEllipse.center, // Center coordinates
        new cv.Size(blackEllipse.size.width / 2, blackEllipse.size.height / 2), // Radii of the ellipse
        blackEllipse.angle, // Rotation angle 
        blackEllipse.angle - 180, // Starting angle (0 degrees)
        blackEllipse.angle + 180, // Ending angle (360 degrees)
        new cv.Scalar(0, 0, 255), // Color of the ellipse (red)
        2, // Thickness of the ellipse outline
        cv.LINE_AA // Line type (anti-aliased)
    );
    cv.circle(ellipseVisualisation, new cv.Point(blackEllipse.center.x, blackEllipse.center.y), 5, new cv.Scalar(0, 0, 255, 255), -1);
    
    // appendImage(ellipseVisualisation)

    let blackEllipseMask = generateMaskForEllipse(blackEllipse, src);

    let insideBlackCircleImage = new cv.Mat();
    cv.bitwise_and(src, src, insideBlackCircleImage, blackEllipseMask);
    // appendImage(insideBlackCircleImage)

    const insideBlackCircleGray = new cv.Mat();
    cv.cvtColor(insideBlackCircleImage, insideBlackCircleGray, cv.COLOR_RGBA2GRAY, 0);
    // appendImage(insideBlackCircleGray)

    const blueEllipse = getBrighterInnerEllipse(insideBlackCircleGray, blackEllipseMask, 1);
    drawEllipse(blueEllipse, ellipseVisualisation)

    const blueEllipseMask = generateMaskForEllipse(blueEllipse, src);

    const redFilter = extractRed(insideBlackCircleImage);
    const redEllipse = getBrighterInnerEllipse(redFilter, blueEllipseMask, .5, true);
    drawEllipse(redEllipse, ellipseVisualisation)

    const yellowEllipse = getBrighterInnerEllipse(insideBlackCircleGray, blueEllipseMask, 1.5);
    drawEllipse(yellowEllipse, ellipseVisualisation)

    const black2Ellipse = getAverageEllipse(blueEllipse, blackEllipse);
    drawEllipse(black2Ellipse, ellipseVisualisation)
    
    const whiteEllipses = getNextEllipseRecursive(blackEllipse, black2Ellipse, 'out', 2)
    for (let i = 0; i < whiteEllipses.length; i++) drawEllipse(whiteEllipses[i], ellipseVisualisation)
    
    const blue2Ellipse = getAverageEllipse(blueEllipse, redEllipse);
    drawEllipse(blue2Ellipse, ellipseVisualisation)

    const red2Ellipse = getAverageEllipse(redEllipse, yellowEllipse);
    drawEllipse(red2Ellipse, ellipseVisualisation)

    const yellow2Ellipses = getNextEllipseRecursive(red2Ellipse, yellowEllipse, 'in', 1)
    drawEllipse(yellow2Ellipses[0], ellipseVisualisation)

    // appendImage(ellipseVisualisation)

    const ellipses = [
        whiteEllipses[1],
        whiteEllipses[0],
        blackEllipse,
        black2Ellipse,
        blueEllipse,
        blue2Ellipse,
        redEllipse,
        red2Ellipse,
        yellowEllipse,
        yellow2Ellipses[0],
    ]

    const leftDrift = ellipses[0].center.x > ellipses[ellipses.length -1].center.x;
    const perspective = leftDrift ? 'right' : 'left';

    return { ellipses, ellipseVisualisation, perspective };
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

const getHypotenuse = (width: number, height: number) => {
    return Math.sqrt(width ** 2 + height ** 2);
}

const removeTinyEdges = (binaryMat: cv.Mat) => {
    let labels = new cv.Mat();
    let stats = new cv.Mat();
    let centroids = new cv.Mat();
    const output = binaryMat.clone();

    // Find connected components
    let numLabels = cv.connectedComponentsWithStats(binaryMat, labels, stats, centroids);

    // Loop through detected components
    for (let i = 1; i < numLabels; i++) {  // Start from 1 (0 is background)
        let area = stats.intAt(i, cv.CC_STAT_AREA);
        let w = stats.intAt(i, cv.CC_STAT_WIDTH);
        let h = stats.intAt(i, cv.CC_STAT_HEIGHT);
        let x = stats.intAt(i, cv.CC_STAT_LEFT);
        let y = stats.intAt(i, cv.CC_STAT_TOP);
        let hypotenuse = Math.abs(Math.ceil(getHypotenuse(w, h))) * 1.1; // Number of pixels that are in the diagonal line
        // If the coloured in pixels are more than the number
        // of pixels if the box only has a straight line, delete it
        if ((area > hypotenuse && area < 40) || area < 10) {  
            output.roi(new cv.Rect(x, y, w, h)).setTo(new cv.Scalar(0));  // Erase small dots
            
        }
        // if (area < 30) {  // Threshold: Remove areas smaller than 10 pixels
        //     output.roi(new cv.Rect(x, y, w, h)).setTo(new cv.Scalar(0));
        // }
    }

    // Cleanup
    labels.delete();
    stats.delete();
    centroids.delete();

    return output
}



const arrowDetection = (src: cv.Mat, perspective: 'left' | 'right', targetEdges: cv.RotatedRect[]) => {
    const clone = src.clone();
    appendImage(src);
    appendImage(createUTemplate());
 
    let scalar = new cv.Scalar(200, 200, 200);  // Scalar to add for brightening
    // let brightenedMat = new cv.Mat();  // Create an empty matrix for the result
    // let matrix = new cv.Mat(src.rows, src.cols, src.type(), scalar);
    // cv.add(src, matrix, brightenedMat);
    
    // appendImage(brightenedMat, 'brightenedMat');

    // 2. Convert to grayscale
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const enhanceDark = enhanceDarkContrast(gray);
    appendImage(enhanceDark, 'enhanceDark');
    const enhanceDark2 = adjustGamma(enhanceDark);
    appendImage(enhanceDark2, 'enhanceDark2');

    const blurred = new cv.Mat();
    cv.GaussianBlur(enhanceDark2, blurred, new cv.Size(0, 0), 2);

    // 4. Detect edges using Canny edge detector
    let edges = new cv.Mat();
    cv.Canny(blurred, edges, 15, 20);

    // Eliminate tiny edges
    let edgesClean = removeTinyEdges(edges);

    let template = createUTemplate(); // Function to create the "U" shape template

      const matchingList: {angle: number, position: cv.Point }[] = [];
      const visual = new cv.Mat();
      cv.cvtColor(edgesClean, visual, cv.COLOR_GRAY2RGB);

      // Rotate the template at multiple angles and apply template matching
      for (let scale = 1; scale < 1.5; scale += 0.2) {
        for (let angle = 0; angle < 360; angle += 5) {
            const matchSize = 20;
            let rotatedTemplate = rotateImage(template, angle, matchSize);

            const resizedTemplate = new cv.Mat();
            const newSize = new cv.Size(matchSize * scale, matchSize * scale);
            cv.resize(rotatedTemplate, resizedTemplate, newSize, 0, 0, cv.INTER_LINEAR);
            appendImage(resizedTemplate);
            let matchResult = new cv.Mat();
            
            // Apply template matching
            // cv.matchTemplate(edgesClean, resizedTemplate, matchResult, cv.TM_CCOEFF_NORMED);
            
            // const matchWidth = rotatedTemplate.cols;
            // const matchHeight = rotatedTemplate.rows;
            // const threshold = 0.6;
            // for (let y = 0; y < matchResult.rows; y++) {
            //     for (let x = 0; x < matchResult.cols; x++) {
            //     let score = matchResult.floatAt(y, x);
            //     if (score >= threshold) {
            //         // Draw a rectangle around the detected region
            //         let topLeft = new cv.Point(x, y);
            //         let bottomRight = new cv.Point(x + matchWidth, y + matchHeight);
            //         cv.rectangle(visual, topLeft, bottomRight, new cv.Scalar(0, score * 255, 0), 2);
            //         matchingList.push({
            //             angle,
            //             position: new cv.Point(x + matchWidth / 2, y + matchHeight / 2),
            //         });
            //     }
            //     }
            // }
            
            matchResult.delete();
            rotatedTemplate.delete();
        }
      }

      // Draw a rectangle at the best match location

    // 7. Show the result
    appendImage(blurred, 'blurred')
    appendImage(edges, 'edges');
    // appendImage(targetLines, 'targetLines');
    appendImage(edgesClean, 'edgesClean');
    // appendImage(morphed, 'morphed');
    appendImage(visual, 'visual');
    appendImage(clone);

    // 8. Cleanup
    gray.delete();
    // blurred.delete();
    edges.delete();

    return {
        dst: clone,
        points: matchingList.map((m) => (m.position)),
    };
}

const isPointInsideEllipse = (point: cv.Point, ellipse: cv.RotatedRect) => {
    // Extract ellipse parameters
    let center = ellipse.center;
    let size = ellipse.size;
    let angle = ellipse.angle;

    // Convert the angle from degrees to radians
    let angleRad = Math.PI * angle / 180;

    // Translate the point to the ellipse's coordinate system
    let dx = point.x - center.x;
    let dy = point.y - center.y;

    // Rotate the point by the negative of the ellipse's angle
    let rotatedX = dx * Math.cos(-angleRad) - dy * Math.sin(-angleRad);
    let rotatedY = dx * Math.sin(-angleRad) + dy * Math.cos(-angleRad);

    // Check if the point lies inside the ellipse equation
    let a = size.width / 2;  // Semi-major axis
    let b = size.height / 2; // Semi-minor axis
    let inside = (rotatedX * rotatedX) / (a * a) + (rotatedY * rotatedY) / (b * b) <= 1;

    return inside;
}

const processPointsAgainstEllipses = (points: cv.Point[], ellipses: cv.RotatedRect[]) => {
    let result = [];
    
    // Iterate over the ellipses in reverse order (to prioritize the last ellipses)
    for (let j = 0; j < points.length; j++) {
        for (let i = ellipses.length - 1; i >= 0; i--) {
            let ellipse = ellipses[i];
            let point = points[j];
            if (isPointInsideEllipse(point, ellipse)) {
                result.push({ point, ellipseIndex: i});
                break;
            }
        }
    }
    
    return result;
}

const resizeImage = (src: cv.Mat) => {
    const { width, height } = src.size();
    let dst = new cv.Mat();
    const smallerSideDimension = 900;

    const generateNewSize = () => {
        if (width > height) {
            return new cv.Size(
                smallerSideDimension,
                Math.round(smallerSideDimension * height / width
            ))
        }
        return new cv.Size(
            Math.round(smallerSideDimension * width / height),
            smallerSideDimension
        )
    }
    let dsize = generateNewSize();
    cv.resize(src, dst, dsize, 0, 0, cv.INTER_AREA);
    return dst;
}

export const blackCircle = (original: cv.Mat) => {
    const src = resizeImage(original);
    const { ellipses, ellipseVisualisation, perspective } = getEllipses(src);
    const biggestEllipse = ellipses[0];
    let biggestEllipseMask = generateMaskForEllipse(biggestEllipse, src);
    let insideBiggestEllipse = new cv.Mat();
    cv.bitwise_and(src, src, insideBiggestEllipse, biggestEllipseMask);
    const { dst: dst3, points } = arrowDetection(insideBiggestEllipse, perspective as any, ellipses) || {};
    const results = processPointsAgainstEllipses(points, ellipses);
    console.log('results', results)
    const clone = src.clone();
    for (let i = 0; i < results.length; i++) {
        cv.putText(clone, `${results[i].ellipseIndex + 1}`, results[i].point, cv.FONT_HERSHEY_SIMPLEX, 0.5, new cv.Scalar(255, 255, 255), 1);
    }
    appendImage(clone);
    const result = results.reduce((prev, curr) => prev + curr.ellipseIndex + 1, 0);
    appendResult(result);
}