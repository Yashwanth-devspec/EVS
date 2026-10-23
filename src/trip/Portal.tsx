import React from 'react';
import { createPortal } from 'react-dom';

/** Overlays render at the end of <body>, above the fixed Trip screen and the bottom nav. */
export const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => createPortal(children, document.body);
