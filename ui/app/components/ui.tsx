import React, { forwardRef } from 'react';
import "./ui.module.css";

export const Button = ({ children, className = "", ...props }) => {
  return (
    <button className={`ui-button ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Card = ({ children, className = "" }) => {
  return <div className={`ui-card ${className}`}>{children}</div>;
};


export const CardContent = forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string }>(
  ({ children, className }, ref) => {
    return (
      <div ref={ref} className={`ui-card-content ${className}`}>
        {children}
      </div>
    );
  }
);