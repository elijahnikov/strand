import { i } from "@instantdb/core";

const _schema = i.schema({
  entities: {},
  rooms: {
    workspace: {
      presence: i.entity({
        userId: i.string(),
        name: i.string(),
        avatar: i.string(),
      }),
    },
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
