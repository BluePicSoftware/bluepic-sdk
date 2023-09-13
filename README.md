# Advances Template Embedding

You may not want to allow users to download the generated graphics, but process the generated input data yourself. For this purpose, you can use the Bluepic SDK to communicate with the iframe.
## Get the bluepic SDK
```bash
npm install bluepic
```

## Create an embedded controller

```typescript
import { BluepicEmbedded } from 'bluepic'

// Initialize the controller by passing a query selector to the iframe or an iframe element instead
const embedded = new BluepicEmbedded('#embedded-frame');

// Wait until the embedded template finishes loading
embedded.on('load', () => {
  console.log('READY', embedded.data);
});
```

## Listen for updates

```typescript 
embedded.on('upate', newData => {
  console.log('NEW DATA', newData);
});
```

## Get data

```typescript
// This will return a copy of the current data (if the template finished loading )
const currData = jausembedded.data;
```

## Set data

```typescript
// Please keep in mind, that the instance should have triggered the 'load' event here already
// If you try to do this and the instance is not ready yet, this will not work
embedded.data = {
   foo: 42,
   bar: 42 * 42
}

// Change top level properties directly 
embedded.data.foo = 86; // ✅ works
embedded.data.myObject.subProp = 'hello world'; // 🚨 will not work
```