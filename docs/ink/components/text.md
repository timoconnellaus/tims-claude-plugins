---
topic: ink/components/text
title: Text Component
description: This component can display text and change its style to make it
  bold, underlined, italic, or strikethrough.
version: 5.x
sourceUrl: https://github.com/vadimdemedes/ink
tags:
  - ink
  - components
---

### `<Text>`

This component can display text and change its style to make it bold, underlined, italic, or strikethrough.

```jsx
import {render, Text} from 'ink';

const Example = () => (
	<>
		<Text color="green">I am green</Text>
		<Text color="black" backgroundColor="white">
			I am black on white
		</Text>
		<Text color="#ffffff">I am white</Text>
		<Text bold>I am bold</Text>
		<Text italic>I am italic</Text>
		<Text underline>I am underline</Text>
		<Text strikethrough>I am strikethrough</Text>
		<Text inverse>I am inversed</Text>
	</>
);

render(<Example />);
```

**Note:** `<Text>` allows only text nodes and nested `<Text>` components inside of it. For example, `<Box>` component can't be used inside `<Text>`.