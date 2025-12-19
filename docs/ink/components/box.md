---
topic: ink/components/box
title: Box Component
description: "`<Box>` is an essential Ink component to build your layout."
version: 5.x
sourceUrl: https://github.com/vadimdemedes/ink
tags:
  - ink
  - components
---

### `<Box>`

`<Box>` is an essential Ink component to build your layout.
It's like `<div style="display: flex">` in the browser.

```jsx
import {render, Box, Text} from 'ink';

const Example = () => (
	<Box margin={2}>
		<Text>This is a box with margin</Text>
	</Box>
);

render(<Example />);
```

#### Dimensions

#### Padding

##### padding

Type: `number`\
Default: `0`

Padding on all sides. Equivalent to setting `paddingTop`, `paddingBottom`, `paddingLeft` and `paddingRight`.

```jsx
<Box paddingTop={2}><Text>Top</Text></Box>
<Box paddingBottom={2}><Text>Bottom</Text></Box>
<Box paddingLeft={2}><Text>Left</Text></Box>
<Box paddingRight={2}><Text>Right</Text></Box>
<Box paddingX={2}><Text>Left and right</Text></Box>
<Box paddingY={2}><Text>Top and bottom</Text></Box>
<Box padding={2}><Text>Top, bottom, left and right</Text></Box>
```

#### Margin

##### margin

Type: `number`\
Default: `0`

Margin on all sides. Equivalent to setting `marginTop`, `marginBottom`, `marginLeft` and `marginRight`.

```jsx
<Box marginTop={2}><Text>Top</Text></Box>
<Box marginBottom={2}><Text>Bottom</Text></Box>
<Box marginLeft={2}><Text>Left</Text></Box>
<Box marginRight={2}><Text>Right</Text></Box>
<Box marginX={2}><Text>Left and right</Text></Box>
<Box marginY={2}><Text>Top and bottom</Text></Box>
<Box margin={2}><Text>Top, bottom, left and right</Text></Box>
```

#### Gap

#### gap

Type: `number`\
Default: `0`

Size of the gap between an element's columns and rows. A shorthand for `columnGap` and `rowGap`.

```jsx
<Box gap={1} width={3} flexWrap="wrap">
	<Text>A</Text>
	<Text>B</Text>
	<Text>C</Text>
</Box>
// A B
//
// C
```

#### Flex

#### Visibility

#### Borders

#### Background