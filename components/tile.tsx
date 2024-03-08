import { LETTER_SCORES } from '@/utils';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { memo, useMemo } from 'react';

type TileType = 'base' | 'placed' | 'placing';

type Props = {
    onDrop?: (rowIndex: number, colIndex: number) => void;
    onGrab?: () => void;
    tile: string | null;
    type: TileType;
    bonus?: string | null;
    highlighted?: boolean;
    rowIndex: number;
    colIndex: number;
}

function getZIndex(type: TileType, highlighted?: boolean) {
  if (highlighted) return 'z-[110]';

  switch (type) {
  case 'base':
    return 'z-[100]';
  case 'placed':
    return 'z-[990]';
  case 'placing':
    return 'z-[999]';
  }
}

function getTileColor(tile: string | null, type: TileType, highlighted?: boolean) {
  if (highlighted) return 'bg-secondary shadow-tile shadow-secondary transition-all ';

  if (type === 'base') {
    switch (tile) {
    case '3W':
      return 'bg-[#f31260]';
    case '2W':
      return 'bg-[#18c864]';
    case '3L':
      return 'bg-[#9254d0]';
    case '2L':
      return 'bg-[#0070ef]';
    case 'start':
      return 'bg-[#eda023]';
    default:
      return 'bg-content1';
    }
  }

  return 'bg-default';
}

function getInnerColor(type: TileType) {
  if (type === 'placed') {
    return 'bg-warning brightness-75';
  }

  if (type === 'placing') {
    return 'bg-warning';
  }

  return '';
}

function getRounding(type: TileType) {
  if (type !== 'base') {
    return 'rounded-md';
  }

  return '';
}

function InternalTile({ onDrop, tile, type, onGrab, bonus, highlighted, rowIndex, colIndex }: Props) {
  const center = useMemo(() => type === 'base' && rowIndex === 7 && colIndex === 7, [type, rowIndex, colIndex]);

  return (
    <motion.div
      initial={{ scale: 1.1 }}
      animate={{ scale: 1 }}
      className={
        'absolute transition-all duration-100 flex w-full h-full ' 
        + `${getTileColor(tile, type, highlighted)} ${getZIndex(type, highlighted)}`
      }
      onMouseUp={(e) => {
        onDrop?.(rowIndex, colIndex);

        if (type !== 'base') {
          e.stopPropagation();
        }
      }}
      onMouseDown={() => onGrab?.()}
    >
      <div
        className={`flex w-full h-full justify-center items-center z-[9999] ${
          type !== 'base' ? 'font-black text-white/80 text-xl 2xl:text-2xl': ''
        } ${getInnerColor(type)} ${getRounding(type)}`}
      >
        {center ? (
          <Icon icon="solar:star-bold" className="text-4xl" />
        ): (
          <>
            {tile &&
              <div className="absolute top-1 right-1 leading-tight text-[0.6rem] font-semibold">
                {LETTER_SCORES[tile]}
              </div>
            }
            {bonus &&
              <div className="text-white brightness-[500%] absolute top-1 left-1 leading-tight text-[0.6rem] font-bold">
                {bonus}
              </div>
            }
            <div className="drop-shadow-md">{tile === '_' ? '': tile?.toUpperCase()}</div>
          </>
        )}
      </div>
    </motion.div>
  );
}

const Tile = memo(InternalTile);

export default Tile;