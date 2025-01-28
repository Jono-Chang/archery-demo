import { appendImage } from "../helper/appendImage";
import cv from "@techstark/opencv-js";

const increaseSaturation = (srcMat: cv.Mat, scale: number) => {
    return srcMat;
}

export const saturation = (src: cv.Mat) => {
    appendImage(src, 'src');
    const saturated = increaseSaturation(src, 1.5)
    appendImage(saturated, 'saturated');
}