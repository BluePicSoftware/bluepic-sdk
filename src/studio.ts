import { StudioResources, Template } from '@bluepic/types';
import { getQuery } from './util/query';
import _ from 'lodash';

const studioResourcesBaseUrl = 'https://studio-resources.c2.bluepic.io';
//const studioResourcesBaseUrl = 'http://localhost:8082';

// export async function listProjects(auth) {
//   const files = await fetch(`${ studioResourcesBaseUrl }/api/files`).then(r => r.json());
// }

export class SuperClient {
  auth: string;
  constructor(auth: string) {
    this.auth = auth;
  }
  async studioResourcesCall<T>({ endpoint, query, method, body, contentType }: { endpoint: string[]; query?: { [k: string]: unknown }; method?: string; body?: any; contentType?: string }) {
    const url = `${studioResourcesBaseUrl}/api/${endpoint.join('/')}?${getQuery(query ?? {}).toString()}`;
    const headers = {
      Authorization: this.auth,
      'Content-Type': contentType ? contentType : typeof body === 'object' ? 'application/json' : '',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: headers['Content-Type'].startsWith('application/json') ? JSON.stringify(body) : body,
    });
    const data = await response.json();
    return data as T;
  }
}

export class StudioClient extends SuperClient {
  constructor(auth: string) {
    super(auth);
  }
  async listFolders(): Promise<StudioResources.Folder[]> {
    const folders = await this.studioResourcesCall<StudioResources.Folder[]>({ endpoint: ['folders'] });
    return folders;
  }
  async getFolderByName(folderName: string) {
    const folders = await this.listFolders();
    const folder = folders.find((f) => f.name === folderName);
    return folder;
  }
  async *getProjects(folderName: string, perIteration = 1) {
    const folder = await this.getFolderByName(folderName);
    let index = 0;
    let total = Infinity;
    while (index < total - 1) {
      const files = await this.studioResourcesCall<StudioResources.FilesOutput>({
        endpoint: ['files'],
        query: {
          start: index,
          limit: perIteration,
          mode: 'read',
          tags: ['studio', 'project'].join(','),
          type: '^application/json\\+bx$',
          folder: folder?._id,
        },
      });
      total = files.total;
      index += files.files.length;
      for (const file of files.files) {
        yield new TemplateFile(this.auth, file);
      }
    }
  }
  async listProjects(folderName: string) {
    const folder = await this.getFolderByName(folderName);
    if (!folder) {
      throw new Error(`Folder ${folderName} not found`);
    }

    const files = await this.studioResourcesCall<StudioResources.FilesOutput>({
      endpoint: ['files'],
      query: {
        mode: 'read',
        tags: ['studio', 'project'].join(','),
        type: '^application/json\\+bx$',
        folder: folder._id,
      },
    });

    return files.files.map((file) => new TemplateFile(this.auth, file));
  }
  async duplicateProject(projectId: string, name: string, folder?: string) {
    const folderId = folder
      ? folder
      : await (async () => {
          const file = await this.studioResourcesCall<StudioResources.File>({ endpoint: ['files', projectId] });
          return file.folder;
        })();
    const newProjectRecord = await this.studioResourcesCall<StudioResources.File>({
      method: 'PUT',
      endpoint: ['files', projectId, 'duplicate'],
      query: {
        name,
        folder: folderId,
        duplicateObjects: ['default', 'preview'].join(','),
      },
    });
    return new TemplateFile(this.auth, newProjectRecord);
  }
  async deleteProject(projectId: string) {
    return await this.studioResourcesCall<{ success: boolean }>({
      method: 'DELETE',
      endpoint: ['files', projectId],
    });
  }
}

function getAllElements(slot: Template.Element[]): Template.Element[] {
  return [
    ...slot,
    ...slot.flatMap((element) => {
      const childElements = (() => {
        if (element.name === 'group') {
          return [...element.slots.default, ...(element.slots.mask ?? [])];
        } else if (element.name === 'mask') {
          return [...element.slots.default, ...element.slots.mask];
        } else if (element.name === 'iteration') {
          return element.child ? [element.child] : [];
        } else {
          return [];
        }
      })();
      return getAllElements(childElements);
    }),
  ];
}

export class TemplateFile extends SuperClient {
  serial: Promise<Template.Serial>;
  file: Promise<StudioResources.File>;
  constructor(auth: string, file: StudioResources.File | string) {
    super(auth);
    this.file = typeof file === 'string' ? this.studioResourcesCall<StudioResources.File>({ endpoint: ['files', file] }) : new Promise((resolve) => resolve(file));
    this.serial = this.studioResourcesCall<Template.Serial>({ endpoint: ['files', typeof file === 'string' ? file : file._id, 'default'] });
    //this.serial = this.getTemplateSerial();
  }
  async patchFile(patchObj: { name?: string }) {
    const file = await this.file;
    const result = await this.studioResourcesCall<{ success: boolean }>({
      method: 'PATCH',
      endpoint: ['files', file._id],
      body: patchObj,
    });
    if (result.success) {
      return true;
    }
    return false;
  }
  async getName() {
    const file = await this.file;
    return file.name;
  }
  async setName(newName: string) {
    const serial = await this.serial;
    serial.name = newName;
    //await this.patchFile({ name: newName });
    const newSerial = {
      ...serial,
      name: newName,
    };
    await this.updateSerial(newSerial);

    // await this.updateSerial({
    //   ...serial,
    //   name: newName,
    // });
  }
  async updateSerial(newSerial: Template.Serial) {
    const file = await this.file;
    await this.studioResourcesCall<{ success: boolean }>({
      method: 'PUT',
      endpoint: ['files', file._id],
      body: newSerial,
      contentType: 'application/json+bx',
      query: {
        name: newSerial.name,
        tags: ['studio', 'project'].join(','),
        previewType: 'webp',
      },
    });
  }
  async getElement(elementId: string) {
    const serial = await this.serial;
    const allElements = getAllElements(serial.context);
    const element = allElements.find((e) => e.id === elementId);

    return element;
  }
  static updateElement(serial: Template.Serial, elementId: string, propertyName: string, newExpr: string) {
    const allElements = getAllElements(serial.context);
    const element = allElements.find((e) => e.id === elementId);
    if (element) {
      element.properties[propertyName as keyof typeof element.properties] = {
        type: 'expression',
        value: newExpr,
      };
    }
  }
  async updateElement(elementId: string, propertyName: string, newExpr: string) {
    const serial = _.cloneDeep(await this.serial);
    TemplateFile.updateElement(serial, elementId, propertyName, newExpr);
    return serial;
  }
  async duplicate(name: string, folder?: string) {
    const file = await this.file;
    const newProjectRecord = await this.studioResourcesCall<StudioResources.File>({
      method: 'PUT',
      endpoint: ['files', file._id, 'duplicate'],
      query: {
        name,
        folder: folder ?? file.folder,
        duplicateObjects: ['default', 'preview'].join(','),
      },
    });
    return new TemplateFile(this.auth, newProjectRecord);
  }
}
