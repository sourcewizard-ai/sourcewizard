'use client';

import { useState, useEffect } from 'react';

interface HourglassProps {
  size?: number;
  glassColor?: string;
  sandColor?: string;
  frameColor?: string;
  capColor?: string;
}

export default function Hourglass({
  size = 32,
  glassColor = '#c0c0c0',
  sandColor = '#111',
  frameColor = '#000',
  capColor = '#000088'
}: HourglassProps) {
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % 8);
    }, 300); // 300ms per frame

    return () => clearInterval(interval);
  }, []);

  const frames = [
    // Frame 0: Sand falling - TOP: 3 blue + 3 straight, BOTTOM: 2 straight + 2 blue  
    (
      <svg width={size} height={size} viewBox="0 0 14 17" style={{ imageRendering: 'pixelated' }}>
        <rect x="2" y="0" width="10" height="2" fill={capColor} />     {/* Top blue cap: 2 pixels tall */}
        <rect x="3" y="2" width="8" height="1" fill={glassColor} />      {/* Top straight connection 1 of 3 */}
        <rect x="3" y="2" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="2" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="3" y="3" width="8" height="1" fill={glassColor} />      {/* Top straight connection 2 of 3 */}
        <rect x="3" y="3" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="3" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="5" y="3" width="4" height="1" fill={sandColor} />         {/* Top sand row with gaps */}
        <rect x="3" y="4" width="8" height="1" fill={glassColor} />      {/* Top straight connection 3 of 3 */}
        <rect x="3" y="4" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="4" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="5" y="4" width="4" height="1" fill={sandColor} />         {/* Top sand layer with gaps */}
        <rect x="3" y="5" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="10" y="5" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="4" y="5" width="6" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="5" y="5" width="4" height="1" fill={sandColor} />         {/* Sand with gaps from walls */}
        <rect x="4" y="6" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="9" y="6" width="1" height="1" fill={frameColor} />         {/* Right wall */}
        <rect x="5" y="6" width="4" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="6" y="6" width="2" height="1" fill={sandColor} />         {/* Sand with gaps from walls */}
        <rect x="5" y="7" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="8" y="7" width="1" height="1" fill={frameColor} />         {/* Right wall */}
        <rect x="6" y="7" width="2" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="6" y="8" width="2" height="1" fill={frameColor} />         {/* Waist (frame) */}
        <rect x="5" y="9" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="8" y="9" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="6" y="9" width="2" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="4" y="10" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="9" y="10" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="5" y="10" width="4" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="3" y="11" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="10" y="11" width="1" height="1" fill={frameColor} />       {/* Right wall */}
        <rect x="4" y="11" width="6" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="3" y="12" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="10" y="12" width="1" height="1" fill={frameColor} />       {/* Right wall */}
        <rect x="4" y="12" width="6" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="3" y="13" width="8" height="1" fill={glassColor} />     {/* Bottom straight connection 1 of 2 */}
        <rect x="3" y="13" width="1" height="1" fill={frameColor} />        {/* Left border */}
        <rect x="10" y="13" width="1" height="1" fill={frameColor} />       {/* Right border */}
        <rect x="3" y="14" width="8" height="1" fill={glassColor} />     {/* Bottom straight connection 2 of 2 */}
        <rect x="3" y="14" width="1" height="1" fill={frameColor} />        {/* Left border */}
        <rect x="10" y="14" width="1" height="1" fill={frameColor} />       {/* Right border */}
        <rect x="2" y="15" width="10" height="2" fill={capColor} />    {/* Bottom blue cap: 2 pixels tall */}
      </svg>
    ),
    // Frame 1: Sand falling - top layer removed
    (
      <svg width={size} height={size} viewBox="0 0 14 17" style={{ imageRendering: 'pixelated' }}>
        <rect x="2" y="0" width="10" height="2" fill={capColor} />     {/* Top blue cap: 2 pixels tall */}
        <rect x="3" y="2" width="8" height="1" fill={glassColor} />      {/* Top straight connection 1 of 3 */}
        <rect x="3" y="2" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="2" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="3" y="3" width="8" height="1" fill={glassColor} />      {/* Top straight connection 2 of 3 */}
        <rect x="3" y="3" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="3" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="3" y="4" width="8" height="1" fill={glassColor} />      {/* Top straight connection 3 of 3 */}
        <rect x="3" y="4" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="4" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="5" y="4" width="4" height="1" fill={sandColor} />         {/* Top sand layer with gaps */}
        <rect x="3" y="5" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="10" y="5" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="4" y="5" width="6" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="5" y="5" width="4" height="1" fill={sandColor} />         {/* Sand with gaps from walls */}
        <rect x="4" y="6" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="9" y="6" width="1" height="1" fill={frameColor} />         {/* Right wall */}
        <rect x="5" y="6" width="4" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="6" y="6" width="2" height="1" fill={sandColor} />         {/* Sand with gaps from walls */}
        <rect x="5" y="7" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="8" y="7" width="1" height="1" fill={frameColor} />         {/* Right wall */}
        <rect x="6" y="7" width="2" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="6" y="8" width="2" height="1" fill={frameColor} />         {/* Waist (frame) */}
        <rect x="5" y="9" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="8" y="9" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="6" y="9" width="2" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="4" y="10" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="9" y="10" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="5" y="10" width="4" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="3" y="11" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="10" y="11" width="1" height="1" fill={frameColor} />       {/* Right wall */}
        <rect x="4" y="11" width="6" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="3" y="12" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="10" y="12" width="1" height="1" fill={frameColor} />       {/* Right wall */}
        <rect x="4" y="12" width="6" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="3" y="13" width="8" height="1" fill={glassColor} />     {/* Bottom straight connection 1 of 2 */}
        <rect x="3" y="13" width="1" height="1" fill={frameColor} />        {/* Left border */}
        <rect x="10" y="13" width="1" height="1" fill={frameColor} />       {/* Right border */}
        <rect x="6" y="13" width="2" height="1" fill={sandColor} />        {/* Bottom sand at real bottom */}
        <rect x="3" y="14" width="8" height="1" fill={glassColor} />     {/* Bottom straight connection 2 of 2 */}
        <rect x="3" y="14" width="1" height="1" fill={frameColor} />        {/* Left border */}
        <rect x="10" y="14" width="1" height="1" fill={frameColor} />       {/* Right border */}
        <rect x="2" y="15" width="10" height="2" fill={capColor} />    {/* Bottom blue cap: 2 pixels tall */}
      </svg>
    ),
    // Frame 2: Sand at y=4 removed, more sand at bottom
    (
      <svg width={size} height={size} viewBox="0 0 14 17" style={{ imageRendering: 'pixelated' }}>
        <rect x="2" y="0" width="10" height="2" fill={capColor} />     {/* Top blue cap: 2 pixels tall */}
        <rect x="3" y="2" width="8" height="1" fill={glassColor} />      {/* Top straight connection 1 of 3 */}
        <rect x="3" y="2" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="2" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="3" y="3" width="8" height="1" fill={glassColor} />      {/* Top straight connection 2 of 3 */}
        <rect x="3" y="3" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="3" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="3" y="4" width="8" height="1" fill={glassColor} />      {/* Top straight connection 3 of 3 */}
        <rect x="3" y="4" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="4" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="3" y="5" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="10" y="5" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="4" y="5" width="6" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="5" y="5" width="4" height="1" fill={sandColor} />         {/* Sand with gaps from walls */}
        <rect x="4" y="6" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="9" y="6" width="1" height="1" fill={frameColor} />         {/* Right wall */}
        <rect x="5" y="6" width="4" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="6" y="6" width="2" height="1" fill={sandColor} />         {/* Sand with gaps from walls */}
        <rect x="5" y="7" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="8" y="7" width="1" height="1" fill={frameColor} />         {/* Right wall */}
        <rect x="6" y="7" width="2" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="6" y="8" width="2" height="1" fill={frameColor} />         {/* Waist (frame) */}
        <rect x="5" y="9" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="8" y="9" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="6" y="9" width="2" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="4" y="10" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="9" y="10" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="5" y="10" width="4" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="3" y="11" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="10" y="11" width="1" height="1" fill={frameColor} />       {/* Right wall */}
        <rect x="4" y="11" width="6" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="3" y="12" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="10" y="12" width="1" height="1" fill={frameColor} />       {/* Right wall */}
        <rect x="4" y="12" width="6" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="5" y="12" width="4" height="1" fill={sandColor} />        {/* Bottom sand expanding */}
        <rect x="3" y="13" width="8" height="1" fill={glassColor} />     {/* Bottom straight connection 1 of 2 */}
        <rect x="3" y="13" width="1" height="1" fill={frameColor} />        {/* Left border */}
        <rect x="10" y="13" width="1" height="1" fill={frameColor} />       {/* Right border */}
        <rect x="5" y="13" width="4" height="1" fill={sandColor} />        {/* More bottom sand at real bottom */}
        <rect x="3" y="14" width="8" height="1" fill={glassColor} />     {/* Bottom straight connection 2 of 2 */}
        <rect x="3" y="14" width="1" height="1" fill={frameColor} />        {/* Left border */}
        <rect x="10" y="14" width="1" height="1" fill={frameColor} />       {/* Right border */}
        <rect x="2" y="15" width="10" height="2" fill={capColor} />    {/* Bottom blue cap: 2 pixels tall */}
      </svg>
    ),
    // Frame 3: Sand at y=5 removed, more sand at bottom
    (
      <svg width={size} height={size} viewBox="0 0 14 17" style={{ imageRendering: 'pixelated' }}>
        <rect x="2" y="0" width="10" height="2" fill={capColor} />     {/* Top blue cap: 2 pixels tall */}
        <rect x="3" y="2" width="8" height="1" fill={glassColor} />      {/* Top straight connection 1 of 3 */}
        <rect x="3" y="2" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="2" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="3" y="3" width="8" height="1" fill={glassColor} />      {/* Top straight connection 2 of 3 */}
        <rect x="3" y="3" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="3" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="3" y="4" width="8" height="1" fill={glassColor} />      {/* Top straight connection 3 of 3 */}
        <rect x="3" y="4" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="4" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="3" y="5" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="10" y="5" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="4" y="5" width="6" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="4" y="6" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="9" y="6" width="1" height="1" fill={frameColor} />         {/* Right wall */}
        <rect x="5" y="6" width="4" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="6" y="6" width="2" height="1" fill={sandColor} />         {/* Sand with gaps from walls */}
        <rect x="5" y="7" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="8" y="7" width="1" height="1" fill={frameColor} />         {/* Right wall */}
        <rect x="6" y="7" width="2" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="6" y="8" width="2" height="1" fill={frameColor} />         {/* Waist (frame) */}
        <rect x="5" y="9" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="8" y="9" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="6" y="9" width="2" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="4" y="10" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="9" y="10" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="5" y="10" width="4" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="3" y="11" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="10" y="11" width="1" height="1" fill={frameColor} />       {/* Right wall */}
        <rect x="4" y="11" width="6" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="6" y="11" width="2" height="1" fill={sandColor} />        {/* Bottom sand expanding */}
        <rect x="3" y="12" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="10" y="12" width="1" height="1" fill={frameColor} />       {/* Right wall */}
        <rect x="4" y="12" width="6" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="5" y="12" width="4" height="1" fill={sandColor} />        {/* More bottom sand */}
        <rect x="3" y="13" width="8" height="1" fill={glassColor} />     {/* Bottom straight connection 1 of 2 */}
        <rect x="3" y="13" width="1" height="1" fill={frameColor} />        {/* Left border */}
        <rect x="10" y="13" width="1" height="1" fill={frameColor} />       {/* Right border */}
        <rect x="5" y="13" width="4" height="1" fill={sandColor} />        {/* Even more bottom sand at real bottom */}
        <rect x="3" y="14" width="8" height="1" fill={glassColor} />     {/* Bottom straight connection 2 of 2 */}
        <rect x="3" y="14" width="1" height="1" fill={frameColor} />        {/* Left border */}
        <rect x="10" y="14" width="1" height="1" fill={frameColor} />       {/* Right border */}
        <rect x="2" y="15" width="10" height="2" fill={capColor} />    {/* Bottom blue cap: 2 pixels tall */}
      </svg>
    ),
    // Frame 4: Sand at y=6 removed, all sand at bottom
    (
      <svg width={size} height={size} viewBox="0 0 14 17" style={{ imageRendering: 'pixelated' }}>
        <rect x="2" y="0" width="10" height="2" fill={capColor} />     {/* Top blue cap: 2 pixels tall */}
        <rect x="3" y="2" width="8" height="1" fill={glassColor} />      {/* Top straight connection 1 of 3 */}
        <rect x="3" y="2" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="2" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="3" y="3" width="8" height="1" fill={glassColor} />      {/* Top straight connection 2 of 3 */}
        <rect x="3" y="3" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="3" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="3" y="4" width="8" height="1" fill={glassColor} />      {/* Top straight connection 3 of 3 */}
        <rect x="3" y="4" width="1" height="1" fill={frameColor} />         {/* Left border */}
        <rect x="10" y="4" width="1" height="1" fill={frameColor} />        {/* Right border */}
        <rect x="3" y="5" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="10" y="5" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="4" y="5" width="6" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="4" y="6" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="9" y="6" width="1" height="1" fill={frameColor} />         {/* Right wall */}
        <rect x="5" y="6" width="4" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="5" y="7" width="1" height="1" fill={frameColor} />         {/* Left wall */}
        <rect x="8" y="7" width="1" height="1" fill={frameColor} />         {/* Right wall */}
        <rect x="6" y="7" width="2" height="1" fill={glassColor} />      {/* Glass */}
        <rect x="6" y="8" width="2" height="1" fill={frameColor} />         {/* Waist (frame) */}
        <rect x="5" y="9" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="8" y="9" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="6" y="9" width="2" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="4" y="10" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="9" y="10" width="1" height="1" fill={frameColor} />        {/* Right wall */}
        <rect x="5" y="10" width="4" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="6" y="10" width="2" height="1" fill={sandColor} />        {/* Additional sand layer with gaps */}
        <rect x="3" y="11" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="10" y="11" width="1" height="1" fill={frameColor} />       {/* Right wall */}
        <rect x="4" y="11" width="6" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="5" y="11" width="4" height="1" fill={sandColor} />        {/* Bottom sand with gaps */}
        <rect x="3" y="12" width="1" height="1" fill={frameColor} />        {/* Left wall */}
        <rect x="10" y="12" width="1" height="1" fill={frameColor} />       {/* Right wall */}
        <rect x="4" y="12" width="6" height="1" fill={glassColor} />     {/* Glass */}
        <rect x="5" y="12" width="4" height="1" fill={sandColor} />        {/* Bottom sand with gaps */}
        <rect x="3" y="13" width="8" height="1" fill={glassColor} />     {/* Bottom straight connection 1 of 2 */}
        <rect x="3" y="13" width="1" height="1" fill={frameColor} />        {/* Left border */}
        <rect x="10" y="13" width="1" height="1" fill={frameColor} />       {/* Right border */}
        <rect x="5" y="13" width="4" height="1" fill={sandColor} />        {/* Full bottom sand with gaps at real bottom */}
        <rect x="3" y="14" width="8" height="1" fill={glassColor} />     {/* Bottom straight connection 2 of 2 */}
        <rect x="3" y="14" width="1" height="1" fill={frameColor} />        {/* Left border */}
        <rect x="10" y="14" width="1" height="1" fill={frameColor} />       {/* Right border */}
        <rect x="2" y="15" width="10" height="2" fill={capColor} />    {/* Bottom blue cap: 2 pixels tall */}
      </svg>
    ),
    // Frame 5: Rotation /
    (
      <div style={{ transform: 'rotate(45deg)', transformOrigin: 'center' }}>
        <svg width={size} height={size} viewBox="0 0 14 17" style={{ imageRendering: 'pixelated' }}>
          <rect x="2" y="0" width="10" height="2" fill={capColor} />
          <rect x="3" y="2" width="8" height="1" fill={glassColor} />
          <rect x="3" y="2" width="1" height="1" fill={frameColor} />
          <rect x="10" y="2" width="1" height="1" fill={frameColor} />
          <rect x="3" y="3" width="8" height="1" fill={glassColor} />
          <rect x="3" y="3" width="1" height="1" fill={frameColor} />
          <rect x="10" y="3" width="1" height="1" fill={frameColor} />
          <rect x="3" y="4" width="8" height="1" fill={glassColor} />
          <rect x="3" y="4" width="1" height="1" fill={frameColor} />
          <rect x="10" y="4" width="1" height="1" fill={frameColor} />
          <rect x="3" y="5" width="1" height="1" fill={frameColor} />
          <rect x="10" y="5" width="1" height="1" fill={frameColor} />
          <rect x="4" y="5" width="6" height="1" fill={glassColor} />
          <rect x="4" y="6" width="1" height="1" fill={frameColor} />
          <rect x="9" y="6" width="1" height="1" fill={frameColor} />
          <rect x="5" y="6" width="4" height="1" fill={glassColor} />
          <rect x="5" y="7" width="1" height="1" fill={frameColor} />
          <rect x="8" y="7" width="1" height="1" fill={frameColor} />
          <rect x="6" y="7" width="2" height="1" fill={glassColor} />
          <rect x="6" y="8" width="2" height="1" fill={frameColor} />
          <rect x="5" y="9" width="1" height="1" fill={frameColor} />
          <rect x="8" y="9" width="1" height="1" fill={frameColor} />
          <rect x="6" y="9" width="2" height="1" fill={glassColor} />
          <rect x="4" y="10" width="1" height="1" fill={frameColor} />
          <rect x="9" y="10" width="1" height="1" fill={frameColor} />
          <rect x="5" y="10" width="4" height="1" fill={glassColor} />
          <rect x="6" y="10" width="2" height="1" fill={sandColor} />
          <rect x="3" y="11" width="1" height="1" fill={frameColor} />
          <rect x="10" y="11" width="1" height="1" fill={frameColor} />
          <rect x="4" y="11" width="6" height="1" fill={glassColor} />
          <rect x="5" y="11" width="4" height="1" fill={sandColor} />
          <rect x="3" y="12" width="1" height="1" fill={frameColor} />
          <rect x="10" y="12" width="1" height="1" fill={frameColor} />
          <rect x="4" y="12" width="6" height="1" fill={glassColor} />
          <rect x="5" y="12" width="4" height="1" fill={sandColor} />
          <rect x="3" y="13" width="8" height="1" fill={glassColor} />
          <rect x="3" y="13" width="1" height="1" fill={frameColor} />
          <rect x="10" y="13" width="1" height="1" fill={frameColor} />
          <rect x="5" y="13" width="4" height="1" fill={sandColor} />
          <rect x="3" y="14" width="8" height="1" fill={glassColor} />
          <rect x="3" y="14" width="1" height="1" fill={frameColor} />
          <rect x="10" y="14" width="1" height="1" fill={frameColor} />
          <rect x="2" y="15" width="10" height="2" fill={capColor} />
        </svg>
      </div>
    ),
    // Frame 6: Rotation - (90° rotation, sand should be on LEFT SIDE due to gravity)
    (
      <div style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
        <svg width={size} height={size} viewBox="0 0 14 17" style={{ imageRendering: 'pixelated' }}>
          <rect x="2" y="0" width="10" height="2" fill={capColor} />     {/* Top blue cap */}
          <rect x="3" y="2" width="8" height="1" fill={glassColor} />      {/* Top straight connection 1 - gray background */}
          <rect x="3" y="2" width="1" height="1" fill={frameColor} />         {/* Top straight - left border */}
          <rect x="10" y="2" width="1" height="1" fill={frameColor} />        {/* Top straight - right border */}
          <rect x="3" y="3" width="8" height="1" fill={glassColor} />      {/* Top straight connection 2 - gray background */}
          <rect x="3" y="3" width="1" height="1" fill={frameColor} />         {/* Top straight - left border */}
          <rect x="10" y="3" width="1" height="1" fill={frameColor} />        {/* Top straight - right border */}
          <rect x="3" y="4" width="8" height="1" fill={glassColor} />      {/* Top straight connection 3 - gray background */}
          <rect x="3" y="4" width="1" height="1" fill={frameColor} />         {/* Top straight - left border */}
          <rect x="10" y="4" width="1" height="1" fill={frameColor} />        {/* Top straight - right border */}
          <rect x="3" y="5" width="1" height="1" fill={frameColor} />         {/* Upper chamber - left wall */}
          <rect x="10" y="5" width="1" height="1" fill={frameColor} />        {/* Upper chamber - right wall */}
          <rect x="4" y="5" width="6" height="1" fill={glassColor} />      {/* Upper chamber - gray background */}
          <rect x="4" y="6" width="1" height="1" fill={frameColor} />         {/* Upper chamber - left wall */}
          <rect x="9" y="6" width="1" height="1" fill={frameColor} />         {/* Upper chamber - right wall */}
          <rect x="5" y="6" width="4" height="1" fill={glassColor} />      {/* Upper chamber - gray background */}
          <rect x="5" y="7" width="1" height="1" fill={frameColor} />         {/* Hourglass neck - left wall */}
          <rect x="8" y="7" width="1" height="1" fill={frameColor} />         {/* Hourglass neck - right wall */}
          <rect x="6" y="7" width="2" height="1" fill={glassColor} />      {/* Hourglass neck - gray background */}
          <rect x="6" y="8" width="2" height="1" fill={frameColor} />         {/* WAIST - frame at hourglass center */}
          <rect x="5" y="9" width="1" height="1" fill={frameColor} />         {/* Hourglass neck - left wall */}
          <rect x="8" y="9" width="1" height="1" fill={frameColor} />         {/* Hourglass neck - right wall */}
          <rect x="6" y="9" width="2" height="1" fill={glassColor} />      {/* Hourglass neck - gray background */}
          <rect x="4" y="10" width="1" height="1" fill={frameColor} />        {/* Lower chamber - left wall */}
          <rect x="9" y="10" width="1" height="1" fill={frameColor} />        {/* Lower chamber - right wall */}
          <rect x="5" y="10" width="4" height="1" fill={glassColor} />     {/* Lower chamber - gray background */}
          <rect x="6" y="10" width="2" height="1" fill={sandColor} />        {/* LEFT SAND LAYER 1 - ADJUST THIS (currently x=5-7, width=3) */}
          <rect x="3" y="11" width="1" height="1" fill={frameColor} />        {/* Lower chamber - left wall */}
          <rect x="10" y="11" width="1" height="1" fill={frameColor} />       {/* Lower chamber - right wall */}
          <rect x="4" y="11" width="6" height="1" fill={glassColor} />     {/* Lower chamber - gray background */}
          <rect x="5" y="11" width="4" height="1" fill={sandColor} />        {/* LEFT SAND LAYER 2 - ADJUST THIS (currently x=5-7, width=3) */}
          <rect x="3" y="12" width="1" height="1" fill={frameColor} />        {/* Lower chamber - left wall */}
          <rect x="10" y="12" width="1" height="1" fill={frameColor} />       {/* Lower chamber - right wall */}
          <rect x="4" y="12" width="6" height="1" fill={glassColor} />     {/* Lower chamber - gray background */}
          <rect x="5" y="12" width="4" height="1" fill={sandColor} />        {/* LEFT SAND LAYER 3 - ADJUST THIS (currently x=5-7, width=3) */}
          <rect x="3" y="13" width="8" height="1" fill={glassColor} />     {/* Bottom straight connection 1 - gray background */}
          <rect x="3" y="13" width="1" height="1" fill={frameColor} />        {/* Bottom straight - left border */}
          <rect x="10" y="13" width="1" height="1" fill={frameColor} />       {/* Bottom straight - right border */}
          <rect x="5" y="13" width="4" height="1" fill={sandColor} />        {/* LEFT SAND LAYER 4 - ADJUST THIS (currently x=5-7, width=3) */}
          <rect x="3" y="14" width="8" height="1" fill={glassColor} />     {/* Bottom straight connection 2 - gray background */}
          <rect x="3" y="14" width="1" height="1" fill={frameColor} />        {/* Bottom straight - left border */}
          <rect x="10" y="14" width="1" height="1" fill={frameColor} />       {/* Bottom straight - right border */}
          <rect x="2" y="15" width="10" height="2" fill={capColor} />    {/* Bottom blue cap */}
        </svg>
      </div>
    ),
    // Frame 7: Rotation \
    (
      <div style={{ transform: 'rotate(135deg)', transformOrigin: 'center' }}>
        <svg width={size} height={size} viewBox="0 0 14 17" style={{ imageRendering: 'pixelated' }}>
          <rect x="2" y="0" width="10" height="2" fill={capColor} />
          <rect x="3" y="2" width="8" height="1" fill={glassColor} />
          <rect x="3" y="2" width="1" height="1" fill={frameColor} />
          <rect x="10" y="2" width="1" height="1" fill={frameColor} />
          <rect x="3" y="3" width="8" height="1" fill={glassColor} />
          <rect x="3" y="3" width="1" height="1" fill={frameColor} />
          <rect x="10" y="3" width="1" height="1" fill={frameColor} />
          <rect x="3" y="4" width="8" height="1" fill={glassColor} />
          <rect x="3" y="4" width="1" height="1" fill={frameColor} />
          <rect x="10" y="4" width="1" height="1" fill={frameColor} />
          <rect x="3" y="5" width="1" height="1" fill={frameColor} />
          <rect x="10" y="5" width="1" height="1" fill={frameColor} />
          <rect x="4" y="5" width="6" height="1" fill={glassColor} />
          <rect x="4" y="6" width="1" height="1" fill={frameColor} />
          <rect x="9" y="6" width="1" height="1" fill={frameColor} />
          <rect x="5" y="6" width="4" height="1" fill={glassColor} />
          <rect x="5" y="7" width="1" height="1" fill={frameColor} />
          <rect x="8" y="7" width="1" height="1" fill={frameColor} />
          <rect x="6" y="7" width="2" height="1" fill={glassColor} />
          <rect x="6" y="8" width="2" height="1" fill={frameColor} />
          <rect x="5" y="9" width="1" height="1" fill={frameColor} />
          <rect x="8" y="9" width="1" height="1" fill={frameColor} />
          <rect x="6" y="9" width="2" height="1" fill={glassColor} />
          <rect x="4" y="10" width="1" height="1" fill={frameColor} />
          <rect x="9" y="10" width="1" height="1" fill={frameColor} />
          <rect x="5" y="10" width="4" height="1" fill={glassColor} />
          <rect x="6" y="10" width="2" height="1" fill={sandColor} />
          <rect x="3" y="11" width="1" height="1" fill={frameColor} />
          <rect x="10" y="11" width="1" height="1" fill={frameColor} />
          <rect x="4" y="11" width="6" height="1" fill={glassColor} />
          <rect x="5" y="11" width="4" height="1" fill={sandColor} />
          <rect x="3" y="12" width="1" height="1" fill={frameColor} />
          <rect x="10" y="12" width="1" height="1" fill={frameColor} />
          <rect x="4" y="12" width="6" height="1" fill={glassColor} />
          <rect x="5" y="12" width="4" height="1" fill={sandColor} />
          <rect x="3" y="13" width="8" height="1" fill={glassColor} />
          <rect x="3" y="13" width="1" height="1" fill={frameColor} />
          <rect x="10" y="13" width="1" height="1" fill={frameColor} />
          <rect x="5" y="13" width="4" height="1" fill={sandColor} />
          <rect x="3" y="14" width="8" height="1" fill={glassColor} />
          <rect x="3" y="14" width="1" height="1" fill={frameColor} />
          <rect x="10" y="14" width="1" height="1" fill={frameColor} />
          <rect x="2" y="15" width="10" height="2" fill={capColor} />
        </svg>
      </div>
    ),
  ];

  return (
    <div
      className="inline-block relative"
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
      }}
    >
      {frames[currentFrame]}

    </div>
  );
}
