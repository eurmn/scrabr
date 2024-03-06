import { LETTER_SCORES } from "@/utils";
import { Button, ButtonProps } from "@nextui-org/button";
import { useRef } from "react";

type Props = {
    letter: string;
    onGrab?: (size: { width: number, height: number, x: number, y: number }) => void;
    onDrop?: () => void;
    invisible?: boolean;
    dragging?: boolean;
    cursor?: boolean;
};

export default function ScrabbleCard({ letter, onDrop, onGrab, invisible, dragging, ...props }: ButtonProps & Props) {
    const ref = useRef<HTMLButtonElement | null>(null);

    return (
        <div style={{
            ...props.style,
            pointerEvents: dragging ? 'none' : 'auto',
        }} className={props.className}>
            <Button
                color="default"
                onMouseDown={(e) => {
                    onGrab?.({
                        height: ref.current?.clientHeight || 0,
                        width: ref.current?.clientWidth || 0,
                        x: e.clientX,
                        y: e.clientY,
                    });
                }}
                onPressEnd={dragging ? onDrop : undefined}
                isIconOnly
                className={
                    `text-white text-4xl h-[4.5rem] w-[4.5rem] box-border hover:scale-105 left-0 my-1 relative`
                    + ` aspect-square shadow-lg` + (invisible ? ' hidden' : ' block')
                }
                ref={ref}
                draggable={false}
            >
                <span
                    className="font-black aspect-square w-full my-auto text-center"
                >
                    {letter === '_' ? '': letter?.toUpperCase()}
                </span>
                <div className="absolute w-5 h-5 font-bold top-1 right-1 rounded-full text-sm flex items-center justify-center">
                    {LETTER_SCORES[letter]}
                </div>
            </Button>
        </div>
    )
}