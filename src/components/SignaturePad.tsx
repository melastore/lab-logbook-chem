"use client";

import { PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { PenLine, Eraser, Check } from "lucide-react";

type SignaturePadProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function SignaturePad({ value, onChange, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const valueRef = useRef(value);
  // Hides the hint the instant the pen touches down, not on pointer-up.
  const [hasInk, setHasInk] = useState(false);

  const prepareCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const context = canvas.getContext("2d");
    if (!context) return null;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.8;
    context.strokeStyle = "#171d1b";
    context.fillStyle = "#171d1b";
    return { canvas, context, width: rect.width, height: rect.height };
  }, []);

  const paintFromValue = useCallback((nextValue: string) => {
    const prepared = prepareCanvas();
    if (!prepared) return;
    const { context, width, height } = prepared;
    context.clearRect(0, 0, width, height);
    if (!nextValue) return;

    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
    };
    image.src = nextValue;
  }, [prepareCanvas]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      paintFromValue(valueRef.current);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => observer.disconnect();
  }, [paintFromValue]);

  useEffect(() => {
    paintFromValue(value);
  }, [paintFromValue, value]);

  function pointFor(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    event.preventDefault();
    const prepared = prepareCanvas();
    const point = pointFor(event);
    if (!prepared || !point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    setHasInk(true);
    lastPointRef.current = point;
    prepared.context.beginPath();
    prepared.context.arc(point.x, point.y, 1.4, 0, Math.PI * 2);
    prepared.context.fill();
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || !drawingRef.current) return;
    event.preventDefault();
    const prepared = prepareCanvas();
    const point = pointFor(event);
    const lastPoint = lastPointRef.current;
    if (!prepared || !point || !lastPoint) return;
    prepared.context.beginPath();
    prepared.context.moveTo(lastPoint.x, lastPoint.y);
    prepared.context.lineTo(point.x, point.y);
    prepared.context.stroke();
    lastPointRef.current = point;
  }

  function stopDrawing(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || !drawingRef.current) return;
    event.preventDefault();
    drawingRef.current = false;
    lastPointRef.current = null;
    onChange(event.currentTarget.toDataURL("image/png"));
  }

  function clearSignature() {
    if (disabled) return;
    const prepared = prepareCanvas();
    if (prepared) prepared.context.clearRect(0, 0, prepared.width, prepared.height);
    setHasInk(false);
    onChange("");
  }

  return (
    <div className={`signature-pad ${disabled ? "disabled" : ""} ${value ? "signed" : ""}`}>
      <div className="signature-frame">
        <canvas
          ref={canvasRef}
          className="signature-canvas"
          aria-label="Analyst drawn signature"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
          style={{ cursor: disabled ? "not-allowed" : "crosshair" }}
        />
        {!value && !disabled && !hasInk && (
          <div className="signature-placeholder" aria-hidden="true">
            <PenLine size={18} />
            <span>Sign here</span>
          </div>
        )}
      </div>

      <div className="signature-actions">
        <span className={`signature-state ${value ? "signed" : ""}`}>
          <span className="signature-dot" aria-hidden="true" />
          {disabled
            ? "Drawn signature disabled"
            : value
              ? <><Check size={14} /> Signature captured</>
              : "Awaiting signature"}
        </span>
        <button
          className="btn btn-outline btn-sm btn-icon-gap"
          type="button"
          onClick={clearSignature}
          disabled={disabled || !value}
        >
          <Eraser size={14} /> Clear
        </button>
      </div>
    </div>
  );
}
