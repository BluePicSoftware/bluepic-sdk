import EventEmitter from 'eventemitter3'

export class BluepicEmbedded extends EventEmitter {
  private iframe: HTMLIFrameElement;
  private __data?: { [k: string]: unknown };
  constructor(iframe: HTMLIFrameElement | string) {
    super();
    if (typeof iframe === 'string') {
      const queriedFrame = document.querySelector(iframe);
      if (queriedFrame && queriedFrame instanceof HTMLIFrameElement) {
        this.iframe = queriedFrame;
      }
      else {
        throw new Error('iframe query selector does not point to an iframe');
      }
    }
    else {
      this.iframe = iframe;
    }

    const messageHandler = ({ data }: MessageEvent) => {
      if (data.type === 'update:ready') {
        const state = JSON.parse(data.data);
        if (state) {
          this.emit('load');
        }
      }
      else if (data.type === 'update:data') {
        const newData = JSON.parse(data.data);
        this.__data = newData;
        this.emit('update', newData);
      }
    }

    window.addEventListener('message', messageHandler);
    this.on('detroy', () => {
      window.removeEventListener('message', messageHandler)
    });
  }
  destroy() {
    this.emit('detroy');
  }
  get data() {
    return this.__data;
  }
  set data(newData) {
    if (this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage({
        type: 'set:data',
        data: JSON.stringify(newData)
      }, '*');
    }
    else {
      throw new Error('contentWindow of iframe cannot be reached');
    }
  }
}
