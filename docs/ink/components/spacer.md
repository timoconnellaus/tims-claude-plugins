---
topic: ink/components/spacer
title: Spacer Component
description: A flexible space that expands along the major axis of its containing layout.
version: 5.x
sourceUrl: https://github.com/vadimdemedes/ink
tags:
  - ink
  - components
---

### `<Spacer>`

A flexible space that expands along the major axis of its containing layout.
It's useful as a shortcut for filling all the available space between elements.

For example, using `<Spacer>` in a `<Box>` with default flex direction (`row`) will position "Left" on the left side and will push "Right" to the right side.

```jsx
import {render, Box, Text, Spacer} from 'ink';

const Example = () => (
	<Box>
		<Text>Left</Text>
		<Spacer />
		<Text>Right</Text>
	</Box>
);

render(<Example />);
```

In a vertical flex direction (`column`), it will position "Top" at the top of the container and push "Bottom" to the bottom.
Note that the container needs to be tall enough to see this in effect.

```jsx
import {render, Box, Text, Spacer} from 'ink';

const Example = () => (
	<Box flexDirection="column" height={10}>
		<Text>Top</Text>
		<Spacer />
		<Text>Bottom</Text>
	</Box>
);

render(<Example />);
```