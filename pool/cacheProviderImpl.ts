import * as anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@project-serum/anchor";
import { CacheDataProvider } from "../entities/cacheProvider";
import { getTickArrayAddress } from "../utils";
import {
  TICK_ARRAY_SIZE,
  Tick,
  TickArray,
  getTickArrayStartIndexByTick,
  getNextTickArrayStartIndex,
  mergeTickArrayBitmap,
  getInitializedTickArrayInRange,
} from "../entities";
import {
  MIN_TICK_ARRAY_START_INDEX,
  MAX_TICK_ARRAY_START_INDEX,
} from "../math";

const FETCH_TICKARRAY_COUNT = 15;

export declare type PoolVars = {
  key: PublicKey;
  token0: PublicKey;
  token1: PublicKey;
  fee: number;
};

export class CacheDataProviderImpl implements CacheDataProvider {
  // @ts-ignore
  program: anchor.Program<AmmCore>;
  poolAddress: PublicKey;

  tickArrayCache: Map<number, TickArray | undefined>;

  // @ts-ignore
  constructor(program: anchor.Program<AmmCore>, poolAddress: PublicKey) {
    this.program = program;
    this.poolAddress = poolAddress;
    this.tickArrayCache = new Map();
  }

  /**
   *  Cache tickArray accounts near the current price
   * @param tickCurrent  The current pool tick
   * @param tickSpacing  The pool tick spacing
   * @param tickArrayBitmapArray
   */
  async loadTickArrayCache(
    tickCurrent: number,
    tickSpacing: number,
    tickArrayBitmapArray: BN[]
  ) {
    const tickArrayBitmap = mergeTickArrayBitmap(tickArrayBitmapArray);
    const tickArraysToFetch = [];
    const currentTickArrayStartIndex = getTickArrayStartIndexByTick(
      tickCurrent,
      tickSpacing
    );

    let startIndexArray = getInitializedTickArrayInRange(
      tickArrayBitmap,
      tickSpacing,
      currentTickArrayStartIndex,
      Math.floor(FETCH_TICKARRAY_COUNT / 2)
    );
    for (let i = 0; i < startIndexArray.length; i++) {
      const [tickArrayAddress, _] = await getTickArrayAddress(
        this.poolAddress,
        this.program.programId,
        startIndexArray[i]
      );
      tickArraysToFetch.push(tickArrayAddress);
    }
    const everyFetch = 5
    const fetchCount = tickArraysToFetch.length / everyFetch + 1
    for (let i = 0; i < fetchCount; i++) {
      let start = i * everyFetch
      let end = start + everyFetch
      if (end > tickArraysToFetch.length) {
        end = tickArraysToFetch.length
      }
      const fetchedTickArrays =
        (await this.program.account.tickArrayState.fetchMultiple(
          tickArraysToFetch.slice(start, end)
        )) as (TickArray | null)[];
      for (const item of fetchedTickArrays) {
        if (item) {
          this.tickArrayCache.set(item.startTickIndex, item);
        }
      }
    }
  }

  public setTickArrayCache(cachedTickArraies: TickArray[]) {
    for (const item of cachedTickArraies) {
      this.tickArrayCache.set(item.startTickIndex, item);
    }
  }

  /**
   * Fetches the cached bitmap for the word
   * @param startIndex
   */
  getTickArray(startIndex: number): TickArray | undefined {
    return this.tickArrayCache.get(startIndex);
  }

  /**
   *
   * @param tickIndex The current tick
   * @param zeroForOne Whether to look for a tick less than or equal to the current one, or a tick greater than or equal to
   * @param tickSpacing The tick spacing for the pool
   * @returns
   */
  async nextInitializedTick(
    tickIndex: number,
    tickSpacing: number,
    zeroForOne: boolean
  ): Promise<[Tick, PublicKey, number]> {
    let {
      initializedTick: nextTick,
      tickArrayAddress,
      tickArrayStartTickIndex,
    } = await this.nextInitializedTickInOneArray(
      tickIndex,
      tickSpacing,
      zeroForOne
    );
    while (nextTick == undefined || nextTick.liquidityGross.lten(0)) {
      tickArrayStartTickIndex = getNextTickArrayStartIndex(
        tickArrayStartTickIndex,
        tickSpacing,
        zeroForOne
      );
      if (
        tickArrayStartTickIndex < MIN_TICK_ARRAY_START_INDEX ||
        tickArrayStartTickIndex > MAX_TICK_ARRAY_START_INDEX
      ) {
        throw new Error("No enough initialized tickArray");
      }
      const cachedTickArray = this.getTickArray(tickArrayStartTickIndex);
      if (cachedTickArray != undefined) {
        [nextTick, tickArrayAddress, tickArrayStartTickIndex] =
          await this.firstInitializedTickInOneArray(
            cachedTickArray,
            zeroForOne
          );
      }
    }
    if (nextTick == undefined) {
      throw new Error("No invaild tickArray cache");
    }
    return [nextTick, tickArrayAddress, tickArrayStartTickIndex];
  }

  async firstInitializedTickInOneArray(
    tickArray: TickArray,
    zeroForOne: boolean
  ): Promise<[Tick, PublicKey, number]> {
    let nextInitializedTick: Tick;
    if (zeroForOne) {
      let i = TICK_ARRAY_SIZE - 1;
      while (i >= 0) {
        const tickInArray = tickArray.ticks[i];
        if (tickInArray.liquidityGross.gtn(0)) {
          nextInitializedTick = tickInArray;
          break;
        }
        i = i - 1;
      }
    } else {
      let i = 0;
      while (i < TICK_ARRAY_SIZE) {
        const tickInArray = tickArray.ticks[i];
        if (tickInArray.liquidityGross.gtn(0)) {
          nextInitializedTick = tickInArray;
          break;
        }
        i = i + 1;
      }
    }
    const [tickArrayAddress, _] = await getTickArrayAddress(
      this.poolAddress,
      this.program.programId,
      tickArray.startTickIndex
    );
    return [nextInitializedTick, tickArrayAddress, tickArray.startTickIndex];
  }

  /**
   *
   * @param tickIndex
   * @param tickSpacing
   * @param zeroForOne
   * @returns
   */
  async nextInitializedTickInOneArray(
    tickIndex: number,
    tickSpacing: number,
    zeroForOne: boolean
  ): Promise<{
    initializedTick: Tick | undefined;
    tickArrayAddress: PublicKey | undefined;
    tickArrayStartTickIndex: number;
  }> {
    const startIndex = getTickArrayStartIndexByTick(tickIndex, tickSpacing);
    let tickPositionInArray = Math.floor(
      (tickIndex - startIndex) / tickSpacing
    );
    const cachedTickArray = this.getTickArray(startIndex);
    if (cachedTickArray == undefined) {
      return {
        initializedTick: undefined,
        tickArrayAddress: undefined,
        tickArrayStartTickIndex: startIndex,
      };
    }
    let nextInitializedTick: Tick;
    if (zeroForOne) {
      while (tickPositionInArray >= 0) {
        const tickInArray = cachedTickArray.ticks[tickPositionInArray];
        if (tickInArray.liquidityGross.gtn(0)) {
          nextInitializedTick = tickInArray;
          break;
        }
        tickPositionInArray = tickPositionInArray - 1;
      }
    } else {
      tickPositionInArray = tickPositionInArray + 1;
      while (tickPositionInArray < TICK_ARRAY_SIZE) {
        const tickInArray = cachedTickArray.ticks[tickPositionInArray];
        if (tickInArray.liquidityGross.gtn(0)) {
          nextInitializedTick = tickInArray;
          break;
        }
        tickPositionInArray = tickPositionInArray + 1;
      }
    }
    const [tickArrayAddress, _] = await getTickArrayAddress(
      this.poolAddress,
      this.program.programId,
      startIndex
    );
    return {
      initializedTick: nextInitializedTick,
      tickArrayAddress,
      tickArrayStartTickIndex: cachedTickArray.startTickIndex,
    };
  }
}
