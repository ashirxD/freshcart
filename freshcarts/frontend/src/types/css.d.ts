/**
 * Next.js only ships ambient types for `*.module.css`, so a global stylesheet
 * imported for its side effects (`import './globals.css'`) has no declaration
 * and TypeScript reports TS2882. Declare the plain-CSS shape here.
 */
declare module '*.css';
declare module '*.scss';
declare module '*.sass';
