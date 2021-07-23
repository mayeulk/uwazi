import mongoose, { Connection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Db } from 'mongodb';
import { FileType } from 'shared/types/fileType';
import { EntitySchema } from 'shared/types/entityType';
import { PageType } from 'shared/types/pageType';
import { DB } from 'api/odm';
import { setupTestUploadedPaths } from 'api/files/filesystem';
import { ThesaurusSchema } from 'shared/types/thesaurusType';
import { UserGroupSchema } from 'shared/types/userGroupType';
import { ObjectIdSchema } from 'shared/types/commonTypes';
import { UserInContextMockFactory } from 'api/utils/testingUserInContext';
import { appContext } from 'api/utils/AppContext';
import { elasticTesting } from './elastic_testing';
import { testingTenants } from './testingTenants';

jest.mock('api/utils/AppContext');

mongoose.set('useFindAndModify', false);
mongoose.Promise = Promise;
let connected = false;
let mongod: MongoMemoryServer;
let mongodb: Db;

export type DBFixture = {
  files?: FileType[];
  entities?: EntitySchema[];
  dictionaries?: ThesaurusSchema[];
  usergroups?: UserGroupSchema[];
  pages?: PageType[];
  [k: string]: any;
};

const fixturer = {
  async clear(db: Db, _collections: string[] | undefined = undefined): Promise<void> {
    const collections: string[] =
      _collections || (await db.listCollections().toArray()).map(c => c.name);

    await Promise.all(
      collections.map(async c => {
        await db.collection(c).deleteMany({});
      })
    );
  },

  async clearAllAndLoad(db: Db, fixtures: DBFixture) {
    await this.clear(db);
    await Promise.all(
      Object.keys(fixtures).map(async collectionName => {
        await db.collection(collectionName).insertMany(fixtures[collectionName]);
      })
    );
  },
};

let mongooseConnection: Connection;

const initMongoServer = async () => {
  mongod = new MongoMemoryServer();
  const uri = await mongod.getUri();
  mongooseConnection = await DB.connect(uri);
  connected = true;
};
const appContextTestValues: { [k: string]: any } = {
  requestId: '1234',
};

const testingDB: {
  mongodb: Db | null;
  connect: (options?: { defaultTenant: boolean } | undefined) => Promise<Connection>;
  disconnect: () => Promise<void>;
  id: (id?: string | undefined) => ObjectIdSchema;
  clear: (collections?: string[] | undefined) => Promise<void>;
  clearAllAndLoad: (fixtures: DBFixture, elasticIndex?: string) => Promise<void>;
  dbName: string;
  appContextSpy: jest.SpyInstance | null;
  setupFixturesAndContext: (fixtures: DBFixture, elasticIndex?: string) => Promise<void>;
} = {
  mongodb: null,
  dbName: '',
  appContextSpy: null,

  async connect(options = { defaultTenant: true }) {
    if (!connected) {
      await initMongoServer();
      // mongo/mongoose types collisions
      //@ts-ignore
      mongodb = mongooseConnection.db;
      this.mongodb = mongodb;

      this.dbName = await mongod.getDbName();

      if (options.defaultTenant) {
        testingTenants.mockCurrentTenant({
          name: this.dbName,
          dbName: this.dbName,
          indexName: 'index',
        });
        await setupTestUploadedPaths();
      }
    }

    return mongooseConnection;
  },

  async disconnect() {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    testingTenants.restoreCurrentFn();
    this.appContextSpy?.mockRestore();
  },

  id(id = undefined) {
    return mongoose.Types.ObjectId(id);
  },

  async clear(collections = undefined) {
    await fixturer.clear(mongodb, collections);
  },

  async setupFixturesAndContext(fixtures: DBFixture, elasticIndex?: string) {
    await this.connect();
    await fixturer.clearAllAndLoad(mongodb, fixtures);
    new UserInContextMockFactory().mockEditorUser();

    this.appContextSpy = jest
      .spyOn(appContext, 'get')
      .mockImplementation((key: string) => appContextTestValues[key]);
    if (elasticIndex) {
      testingTenants.changeCurrentTenant({ indexName: elasticIndex });
      await elasticTesting.reindex();
    }
  },

  /**
   * @deprecated
   */
  async clearAllAndLoad(fixtures: DBFixture, elasticIndex?: string) {
    await this.setupFixturesAndContext(fixtures, elasticIndex);
  },
};

export { testingDB };

// deprecated, for backward compatibility
export default testingDB;
