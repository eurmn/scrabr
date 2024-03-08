import { ScrabbleCard as ScrabbleCardType } from '@/types';
import { LETTER_SCORES } from '@/utils';
import { Button, ButtonProps } from '@nextui-org/button';
import { memo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

type Props = {
    letter: ScrabbleCardType;
    onGrab?: (args: { width: number, height: number, x: number, y: number, letter: ScrabbleCardType }) => void;
    invisible?: boolean;
    dragging?: boolean;
    cursor?: boolean;
    x?: number;
    y?: number;
};

function InternalScrabbleCard({ x, y, letter, onGrab, invisible, dragging, ...props }: ButtonProps & Props) {
  const ref = useRef<HTMLButtonElement | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    onGrab?.({
      height: ref.current?.clientHeight || 0,
      width: ref.current?.clientWidth || 0,
      x: e.clientX,
      y: e.clientY,
      letter
    });
  }, [letter, onGrab]);

  return (
    <motion.div
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      style={{
        ...props.style,
        pointerEvents: dragging ? 'none' : 'auto',
        left: x,
        top: y
      }}
      className={props.className}
    >
      <Button
        color="default"
        onMouseDown={onMouseDown}
        isIconOnly
        className={
          'text-white text-4xl h-[4.5rem] w-[4.5rem] box-border hover:scale-105 left-0 my-1 relative'
          + ' aspect-square shadow-lg' + (invisible ? ' hidden' : ' block')
        }
        ref={ref}
        draggable={false}
      >
        <span
          className="font-black aspect-square w-full my-auto text-center"
        >
          {letter.letter === '_' ? '': letter.letter.toUpperCase()}
        </span>
        <div className="absolute w-5 h-5 font-bold top-1 right-1 rounded-full text-sm flex items-center justify-center">
          {LETTER_SCORES[letter.letter]}
        </div>
      </Button>
    </motion.div>
  );
}

const ScrabbleCard = memo(InternalScrabbleCard);

export default ScrabbleCard;
