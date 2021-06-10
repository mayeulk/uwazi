/* eslint-disable max-lines */
import db from 'api/utils/testing_db';
import entities from 'api/entities';
import path from 'path';
import translations from 'api/i18n';
import { search } from 'api/search';
// import settings from 'api/settings';

import { CSVLoader } from '../csvLoader';
import fixtures, { template1Id } from './csvLoaderFixtures';
import { stream } from './helpers';
import typeParsers from '../typeParsers';

describe('csvLoader', () => {
  const csvFile = path.join(__dirname, '/test.csv');
  const loader = new CSVLoader();

  beforeAll(async () => {
    await db.clearAllAndLoad(fixtures);
    spyOn(search, 'indexEntities').and.returnValue(Promise.resolve());
    spyOn(translations, 'updateContext').and.returnValue(Promise.resolve());
  });

  afterAll(async () => db.disconnect());

  describe('user', () => {
    it('should use the passed user', async () => {
      spyOn(entities, 'save').and.callFake(e => e);
      await loader.load(csvFile, template1Id, { user: { username: 'user' }, language: 'en' });
      expect(entities.save.calls.argsFor(0)[1].user).toEqual({ username: 'user' });
    });
  });

  describe('load translations', () => {
    let csv;
    beforeEach(async () => {
      await db.clearAllAndLoad(fixtures);

      await translations.addLanguage('es');
      await translations.addContext(
        'System',
        'System',
        {
          'original 1': 'original 1',
          'original 2': 'original 2',
          'original 3': 'original 3',
          'original 4': 'original 4',
        },
        ''
      );

      await translations.addLanguage('fr');

      const nonExistent = 'Russian';

      csv = `Key       , English, Spanish, French  , ${nonExistent}  ,
                   original 1, value 1, valor 1, valeur 1, 1               ,
                   original 2, value 2, valor 2, valeur 2, 2               ,
                   original 3, value 3, valor 3, valeur 3, 3               ,`;
    });

    it('should set all translations from csv', async () => {
      await loader.loadTranslations(stream(csv), 'System');
      const [english, spanish, french] = await translations.get();
      expect(english.contexts[0].values).toEqual({
        'original 1': 'value 1',
        'original 2': 'value 2',
        'original 3': 'value 3',
      });
      expect(spanish.contexts[0].values).toEqual({
        'original 1': 'valor 1',
        'original 2': 'valor 2',
        'original 3': 'valor 3',
      });
      expect(french.contexts[0].values).toEqual({
        'original 1': 'valeur 1',
        'original 2': 'valeur 2',
        'original 3': 'valeur 3',
      });
    });

    it('should not update a language that exists in the system but not in csv', async () => {
      await translations.addLanguage('aa');
      await loader.loadTranslations(stream(csv), 'System');
      const [afar] = await translations.get({ locale: 'aa' });
      expect(afar.contexts[0].values).toEqual({
        'original 1': 'original 1',
        'original 2': 'original 2',
        'original 3': 'original 3',
        'original 4': 'original 4',
      });
    });

    it('should add new translation keys from csv', async () => {
      const localCsv = `Key,      English,
                        newKey 1, value 1,
                        newKey 2, value 2,`;

      await loader.loadTranslations(stream(localCsv), 'System');

      const [english] = await translations.get();
      expect(english.contexts[0].values).toEqual({
        'newKey 1': 'value 1',
        'newKey 2': 'value 2',
      });
    });
  });

  describe('load', () => {
    let imported;
    const events = [];

    beforeAll(async () => {
      loader.on('entityLoaded', entity => {
        events.push(entity.title);
      });

      try {
        await loader.load(csvFile, template1Id, { language: 'en' });
      } catch (e) {
        throw loader.errors()[Object.keys(loader.errors())[0]];
      }

      imported = await entities.get({ language: 'en' });
    });

    it('should load title', () => {
      const textValues = imported.map(i => i.title);
      expect(textValues).toEqual(['title1', 'title2', 'title3']);
    });

    it('should generate an id when the template has a property with generatedid type', () => {
      expect(imported[0].metadata).toEqual(
        expect.objectContaining({
          auto_id: [{ value: expect.stringMatching(/^[a-zA-Z0-9-]{12}$/) }],
        })
      );
    });

    it('should emit event after each entity has been imported', () => {
      expect(events).toEqual(['title1', 'title2', 'title3']);
    });

    it('should only import valid metadata', () => {
      const metadataImported = Object.keys(imported[0].metadata);
      expect(metadataImported).toEqual([
        'text_label',
        'numeric_label',
        'select_label',
        'not_defined_type',
        'geolocation_geolocation',
        'auto_id',
      ]);
    });

    it('should ignore properties not configured in the template', () => {
      const textValues = imported.map(i => i.metadata.non_configured).filter(i => i);

      expect(textValues.length).toEqual(0);
    });

    describe('metadata parsing', () => {
      it('should parse metadata properties by type using typeParsers', async () => {
        const textValues = imported.map(i => i.metadata.text_label[0].value);
        expect(textValues).toEqual(['text value 1', 'text value 2', 'text value 3']);

        const numericValues = imported.map(i => i.metadata.numeric_label[0].value);
        expect(numericValues).toEqual([1977, 2019, 2020]);

        const thesauriValues = imported.map(i => i.metadata.select_label[0].label);
        expect(thesauriValues).toEqual(['thesauri1', 'thesauri2', 'thesauri2']);
      });

      describe('when parser not defined', () => {
        it('should use default parser', () => {
          const noTypeValues = imported.map(i => i.metadata.not_defined_type[0].value);
          expect(noTypeValues).toEqual(['notType1', 'notType2', 'notType3']);
        });
      });
    });
  });

  describe('on error', () => {
    it('should stop processing on the first error', async () => {
      const testingLoader = new CSVLoader();

      await db.clearAllAndLoad(fixtures);
      spyOn(entities, 'save').and.callFake(entity => {
        throw new Error(`error-${entity.title}`);
      });

      try {
        await testingLoader.load(csvFile, template1Id);
        fail('should fail');
      } catch (e) {
        expect(e).toEqual(new Error('error-title1'));
      }
    });
    it('should throw the error that occurred even if it was not the first row', async () => {
      const testingLoader = new CSVLoader();

      await db.clearAllAndLoad(fixtures);
      jest
        .spyOn(entities, 'save')
        .mockImplementationOnce(({ title }) => Promise.resolve({ title }))
        .mockImplementationOnce(({ title }) => Promise.reject(new Error(`error-${title}`)));

      try {
        await testingLoader.load(csvFile, template1Id);
        fail('should fail');
      } catch (e) {
        expect(e).toEqual(new Error('error-title2'));
      }
    });
  });

  describe('no stop on errors', () => {
    beforeAll(async () => {
      spyOn(entities, 'save').and.callFake(entity => {
        if (entity.title === 'title1' || entity.title === 'title3') {
          throw new Error(`error-${entity.title}`);
        }
        return entity;
      });
      await db.clearAllAndLoad(fixtures);
    });

    it('should emit an error', async () => {
      const testingLoader = new CSVLoader({ stopOnError: false });

      const eventErrors = {};
      testingLoader.on('loadError', (error, entity) => {
        eventErrors[entity.title] = error;
      });

      try {
        await testingLoader.load(csvFile, template1Id);
      } catch (e) {
        expect(eventErrors).toEqual({
          title1: new Error('error-title1'),
          title3: new Error('error-title3'),
        });
      }
    });

    it('should save errors and index them by csv line, should throw an error on finish', async () => {
      const testingLoader = new CSVLoader({ stopOnError: false });

      try {
        await testingLoader.load(csvFile, template1Id);
        fail('should fail');
      } catch (e) {
        expect(e.message).toMatch(/multiple errors/i);
        expect(testingLoader.errors()).toEqual({
          0: new Error('error-title1'),
          2: new Error('error-title3'),
        });
      }
    });

    it('should fail when parsing throws an error', async () => {
      entities.save.and.callFake(() => Promise.resolve({}));
      spyOn(typeParsers, 'text').and.callFake(entity => {
        if (entity.title === 'title2') {
          throw new Error(`error-${entity.title}`);
        }
      });

      const testingLoader = new CSVLoader({ stopOnError: false });

      try {
        await testingLoader.load(csvFile, template1Id);
        fail('should fail');
      } catch (e) {
        expect(testingLoader.errors()).toEqual({
          1: new Error('error-title2'),
        });
      }
    });
  });

  describe('when sharedId is provided', () => {
    it('should update the entitiy', async () => {
      entities.save.mockRestore();
      const entity = await entities.save(
        { title: 'entity4444', template: template1Id },
        { user: {}, language: 'en' }
      );
      const csv = `id                , title    ,
                   ${entity.sharedId}, new title,
                                     , title2   ,`;

      const testingLoader = new CSVLoader();
      await testingLoader.load(stream(csv), template1Id, { language: 'en' });

      const [expected] = await entities.get({
        sharedId: entity.sharedId,
        language: 'en',
      });
      expect(expected.title).toBe('new title');
    });
  });
});
