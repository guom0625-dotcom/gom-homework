import { useCallback, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { zoomLayout, clampPan, MAX_ZOOM, type Layout } from '../lib/miniroom';

type Pt = [number, number];

// 두 손가락 확대/축소 + 한 손가락 이동 (확대했을 때만)
// 터치 좌표는 방 창 기준. 여러 손가락의 locationX 는 믿을 수 없어서 pageX 에서 창의 위치(offset)를 뺀다
export function useRoomZoom(base: Layout) {
    const [view, setView] = useState({ zoom: 1, px: 0, py: 0 });
    const viewRef = useRef(view);
    viewRef.current = view;
    const offset = useRef<Pt>([0, 0]);
    const pinch = useRef<{ dist: number; mid: Pt; zoom: number; px: number; py: number } | null>(null);
    const panStart = useRef<Pt | null>(null);

    const layout = useMemo(() => zoomLayout(base, view.zoom, view.px, view.py), [base, view]);

    const apply = useCallback((zoom: number, px: number, py: number) => {
        const z = Math.max(1, Math.min(MAX_ZOOM, zoom));
        const [cx, cy] = clampPan(base, z, px, py);
        setView({ zoom: z, px: cx, py: cy });
    }, [base]);

    // 첫 손가락이 닿을 때 창의 화면 위치를 기억해 둔다
    const setOffsetFrom = useCallback((e: GestureResponderEvent) => {
        const { pageX, pageY, locationX, locationY } = e.nativeEvent;
        offset.current = [pageX - locationX, pageY - locationY];
    }, []);

    const points = (e: GestureResponderEvent): Pt[] =>
        e.nativeEvent.touches.map(t => [t.pageX - offset.current[0], t.pageY - offset.current[1]] as Pt);

    // 손가락 두 개: 처음 간격·가운데를 기준으로 확대하고, 가운데가 움직이면 같이 이동
    const pinchMove = useCallback((e: GestureResponderEvent): boolean => {
        const pts = points(e);
        if (pts.length < 2) return false;
        const [a, b] = pts;
        const dist = Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1]));
        const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (!pinch.current) {
            pinch.current = { dist, mid, ...viewRef.current };
            return true;
        }
        const p = pinch.current;
        const zoom = Math.max(1, Math.min(MAX_ZOOM, p.zoom * dist / p.dist));
        // 처음 손가락 가운데 아래 있던 방의 지점이 지금 손가락 가운데 아래 오도록
        const cx = (p.mid[0] - p.px) / p.zoom, cy = (p.mid[1] - p.py) / p.zoom;
        apply(zoom, mid[0] - cx * zoom, mid[1] - cy * zoom);
        return true;
    }, [apply]);

    const pinchEnd = useCallback(() => { pinch.current = null; }, []);
    const pinching = () => pinch.current !== null;

    // 한 손가락으로 빈 곳을 끌면 방 이동 (확대했을 때만 의미 있음)
    const panBegin = useCallback(() => {
        panStart.current = [viewRef.current.px, viewRef.current.py];
    }, []);
    const panMove = useCallback((dx: number, dy: number) => {
        if (!panStart.current || viewRef.current.zoom <= 1) return;
        apply(viewRef.current.zoom, panStart.current[0] + dx, panStart.current[1] + dy);
    }, [apply]);
    const panEnd = useCallback(() => { panStart.current = null; }, []);

    const reset = useCallback(() => setView({ zoom: 1, px: 0, py: 0 }), []);

    return {
        layout, zoom: view.zoom,
        setOffsetFrom, pinchMove, pinchEnd, pinching, panBegin, panMove, panEnd, reset,
    };
}
