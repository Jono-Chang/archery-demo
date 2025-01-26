import cv from "@techstark/opencv-js";
export const appendImage = (img: cv.Mat) => {
const canvasContainer = document.getElementById('canvasContainer');
const image0 = document.createElement("canvas");
cv.imshow(image0, img);
canvasContainer!.appendChild(image0);
}
