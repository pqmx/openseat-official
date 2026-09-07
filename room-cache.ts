import type { Room } from './data';

/** One in-flight feed read per account; old sessions can never refill it. */
export const createRoomCache = (fetchRooms: () => Promise<Room[]>) => {
  let current = { userId: undefined as string | undefined, rooms: [] as Room[], pending: undefined as Promise<Room[] | undefined> | undefined };
  return {
    get userId() { return current.userId; },
    get rooms() { return current.rooms; },
    reset(userId: string | undefined) {
      if (userId === current.userId) return;
      current = { userId, rooms: [], pending: undefined };
    },
    read(): Promise<Room[] | undefined> {
      const snapshot = current;
      if (!snapshot.userId) return Promise.resolve(undefined);
      if (snapshot.pending) return snapshot.pending;
      snapshot.pending = fetchRooms().then((rooms) => {
        if (current !== snapshot) return undefined;
        snapshot.rooms = rooms;
        return rooms;
      }, (error) => {
        if (current !== snapshot) return undefined;
        throw error;
      }).finally(() => { snapshot.pending = undefined; });
      return snapshot.pending;
    },
  };
};
