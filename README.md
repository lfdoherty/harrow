
# Harrow

Harrow is a serialization library compatible with [BoxDS](https://github.com/lfdoherty/boxds).

## API

### serialize(w, handle)
Takes a Writer (see [binutil](https://github.com/lfdoherty/binutil)), and a harrow handle.

### instantiate(buf)
Creates a Harrow handle from a binary buffer.
### instantiateNew(config)
Creates a Harrow handle from a JSON representation.

### merge(stateBuf, updates)
Merges a state buffer and an array of binary update buffers.

### replayUpdate(handle, update, cb)
Replay the update on the Harrow handle and callback with the one or more edit events in the update.

## Example Schema

	{
		'chatroom 1': {
			'roomname': 'string 1',
			'comments': 'list<comment> 2'
		},
		'comment 2': {
			text: 'string 1',
			author: 'string 2',
			creationTime: 'timestamp 3'
		}
	}

Property types:

- int32
- string
- boolean
- timestamp
- *object name*
- set&lt;type&gt;
- list&lt;type&gt;
- map&lt;type,type&gt;


