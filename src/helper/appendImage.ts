import cv from "@techstark/opencv-js";
export const appendImage = (img: cv.Mat, label: string = '') => {
const canvasContainer = document.getElementById('canvasContainer');
const image0 = document.createElement("canvas");
cv.imshow(image0, img);
if (label) {
    const h1 = document.createElement("h1");
    h1.innerHTML = label;
    canvasContainer!.appendChild(h1);
}
canvasContainer!.appendChild(image0);
}
