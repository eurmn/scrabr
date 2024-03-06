import { Bag, ScrabbleCard } from "@/types";

export const LETTER_SCORES: { [key: string]: number } = {
    /* https://pt.wikipedia.org/wiki/Scrabble#Distribui%C3%A7%C3%A3o_das_letras */
    '_': 0,
    a: 1, e: 1, i: 1, o: 1, s: 1, u: 1, m: 1, r: 1, t: 1,
    d: 2, l: 2, c: 2, p: 2,
    n: 3, b: 3, ç: 3,
    f: 4, g: 4, h: 4, v: 4,
    j: 5,
    q: 6,
    x: 8, z: 8
}

export const BonusTiles = generateBonusTiles();

export class Trie {
    private trie: any;
    constructor() {
        this.trie = {};
    }

    loadFromJSON(json: string): void {
        this.trie = JSON.parse(json);
    }

    search(word: string): boolean {
        let node = this.trie;
        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            if (node[char]) {
                node = node[char];
            } else {
                return false;
            }
        }
        return node['*'] === null;
    }

    insert(word: string): void {
        let node = this.trie;
        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            if (!node[char]) {
                node[char] = {};
            }
            node = node[char];
        }
        node['*'] = null;
    }
}

export function generateNewRack(bag: Bag): [ScrabbleCard[], Bag] {
    const rack: ScrabbleCard[] = [];

    // generate rack and remove letters from bag by subtracting from bag
    for (let i = 0; i < 7; i++) {
        const letters = Object.keys(bag).reduce((arr, letter) => {
            if (bag[letter as keyof Bag] > 0 && letter !== 'total') {
                arr.push(...Array(bag[letter as keyof Bag]).fill(letter));
            }
            return arr;
        }, [] as string[]);
        const letter = letters[Math.floor(Math.random() * letters.length)] as keyof Bag;

        rack.push({
            letter,
            id: crypto.randomUUID()
        });

        bag[letter] -= 1;
        bag.total -= 1;
    }

    return [rack, bag];
}

export function drawLetter(bag: Bag): [string, Bag] {
    const letters = Object.keys(bag).reduce((arr, letter) => {
        if (bag[letter as keyof Bag] > 0 && letter !== 'total') {
            arr.push(...Array(bag[letter as keyof Bag]).fill(letter));
        }
        return arr;
    }, [] as string[]);
    const letter = letters[Math.floor(Math.random() * letters.length)] as keyof Bag;

    bag[letter] -= 1;
    bag.total -= 1;

    return [letter, bag];
}

export function generateEmptyBoard(): Array<Array<string>> {
    return Array(15).fill(null).map(() => Array(15).fill(' '));
}

export function generateEmptyPlayBoard(): ScrabbleCard[][] {
    return Array(15).fill(null).map(() => Array(15).fill({ letter: ' ' }));
}

function generateBonusTiles(): Array<Array<string | null>> {
    const emptyBoard = generateEmptyBoard();

    // generate 3W
    const threeW = [
        [0, 0], [0, 7], [0, 14],
        [7, 0], [7, 14],
        [14, 0], [14, 7], [14, 14]
    ];

    for (const [x, y] of threeW) {
        emptyBoard[x][y] = '3W';
    }

    // generate 2W
    const twoW = [
        [1, 1], [2, 2], [3, 3], [4, 4],
        [1, 13], [2, 12], [3, 11], [4, 10],
        [13, 1], [12, 2], [11, 3], [10, 4],
        [13, 13], [12, 12], [11, 11], [10, 10]
    ];

    for (const [x, y] of twoW) {
        emptyBoard[x][y] = '2W';
    }

    // generate 3L
    const threeL = [
        [1, 5], [1, 9],
        [5, 1], [5, 5], [5, 9], [5, 13],
        [9, 1], [9, 5], [9, 9], [9, 13],
        [13, 5], [13, 9]
    ];

    for (const [x, y] of threeL) {
        emptyBoard[x][y] = '3L';
    }

    // generate 2L
    const twoL = [
        [0, 3], [0, 11],
        [2, 6], [2, 8],
        [3, 0], [3, 7], [3, 14],
        [6, 2], [6, 6], [6, 8], [6, 12],
        [7, 3], [7, 11],
        [8, 2], [8, 6], [8, 8], [8, 12],
        [11, 0], [11, 7], [11, 14],
        [12, 6], [12, 8],
        [14, 3], [14, 11]
    ];

    for (const [x, y] of twoL) {
        emptyBoard[x][y] = '2L';
    }

    return emptyBoard;
}

export function isEmptyTile(tile: string) {
    return tile === '' || tile === ' ';
}

type BoardWord = {
    word: string;
    positions: number[][];
}

export function findWordsOnBoard(matrix: string[][]): [string[], number[][][]] {
    let words: string[] = [];
    let wordsPositions: number[][][] = [];
    let size = 15;

    // Check rows
    for(let i = 0; i < size; i++) {
        let row = matrix[i].join('');
        let matches = row.match(/\b\w+\b/g);
        if(matches) {
            matches.forEach(word => {
                let start = row.indexOf(word);
                let positions = Array.from({length: word.length}, (_, k) => [i, start + k]);

                if (word.length > 1) {
                    words.push(word);
                    wordsPositions.push(positions);
                }
            });
        }
    }

    // Check columns
    for(let j = 0; j < size; j++) {
        let col = matrix.map(row => row[j]).join('');
        let matches = col.match(/\b\w+\b/g);
        if(matches) {
            matches.forEach(word => {
                let start = col.indexOf(word);
                let positions = Array.from({length: word.length}, (_, k) => [start + k, j]);

                if (word.length > 1) {
                    words.push(word);
                    wordsPositions.push(positions);
                }
            });
        }
    }

    return [words, wordsPositions];
}

export function getScoreOfWord(word: string, letterPositions: number[][]): number {
    let wordMultiplier = 1;
    let wordScore = word
        .split('')
        .reduce((score, character, index) => {
            let bonus = BonusTiles[letterPositions[index][0]][letterPositions[index][1]];
            let letterScore = LETTER_SCORES[character];
            if (bonus?.endsWith('L')) {
                letterScore *= parseInt(bonus[0]);
            }
            if (bonus?.endsWith('W')) {
                wordMultiplier *= parseInt(bonus[0]);
            }
            return score + letterScore;
        }, 0);
    return wordScore * wordMultiplier;
}

export function generateNewBag(): Bag {
    return {
        total: 120,
        '_': 2,
        a: 14,
        e: 11,
        i: 10,
        o: 10,
        s: 8,
        u: 7,
        m: 6,
        r: 6,
        t: 5,
        d: 5,
        l: 5,
        c: 4,
        p: 4,
        n: 4,
        b: 3,
        f: 3,
        v: 3,
        g: 2,
        h: 2,
        j: 2,
        q: 1,
        x: 1,
        z: 1
    }
}

export function hasLooseTile(matrix: string[][]) {
    const n = matrix.length;
    const m = matrix[0].length;

    const hasNoNeighbours = (i: number, j: number) => {
        const dx = [-1, 0, 1, 0];
        const dy = [0, 1, 0, -1];

        for (let k = 0; k < 4; k++) {
            const ni = i + dx[k];
            const nj = j + dy[k];

            if (ni >= 0 && ni < n && nj >= 0 && nj < m && matrix[ni][nj] !== ' ') {
                return false;
            }
        }

        return true;
    };

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) {
            if (matrix[i][j] !== ' ' && hasNoNeighbours(i, j)) {
                return true;
            }
        }
    }

    return false;
}

export function filterWords(words: string[], wordsPositions: number[][][], positions: number[][], firstMove: boolean): [string[], number[][][]] | null {
    let positionsStr = positions.map(pos => pos.join(','));

    // Filter words and positions
    let filteredWords = [];
    let filteredWordsPositions = [];

    for(let i = 0; i < words.length; i++) {
        let wordPositionsStr = wordsPositions[i].map(pos => pos.join(','));
        if(wordPositionsStr.some(posStr => positionsStr.includes(posStr))) {
            if (!firstMove && wordPositionsStr.every(posStr => positionsStr.includes(posStr))) {
                return null;
            }
            filteredWords.push(words[i]);
            filteredWordsPositions.push(wordsPositions[i]);
        }
    }

    return [filteredWords, filteredWordsPositions];
}

export function generateCombinations(word: string, index: number, currentWord: string, possibleWords: string[]) {
    if (index === word.length) {
        possibleWords.push(currentWord);
        return;
    }

    if (word[index] === '_') {
        for (const letter of Letters) {
            generateCombinations(word, index + 1, currentWord + letter, possibleWords);
        }
    } else {
        generateCombinations(word, index + 1, currentWord + word[index], possibleWords);
    }
}

export const Letters = 'aeiosumrtdlcpnbfghvjqzx';