# UI Components Reference — React ECS

Mode-neutral prop reference for the five React-ECS elements plus the renderer, inset and canvas APIs. The Creator Hub UI editor models a subset of these props (`SKILL.md` → **Elements**); everything here is valid React-ECS in both editable and coded UI unless marked *coded-only*.

## Setup

```typescript
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button, Input, Dropdown } from '@dcl/sdk/react-ecs'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(MyUI)
}
```

Only call `ReactEcsRenderer.setUiRenderer()` once per scene. **A second call does not throw — it silently overwrites the first**, so only the last root renders and the earlier UI vanishes with no error (verified in `@dcl/react-ecs/src/system.ts`: `setUiRenderer` just assigns `uiComponent = ui`). Genuinely independent UI modules use `ReactEcsRenderer.addUiRenderer(entity, ui, options)` / `removeUiRenderer(entity)` — they render alongside the main root rather than replacing it. The renderer function may also return an **array** of elements — `setUiRenderer(() => [PanelA(), PanelB()])` — where later items render on top of earlier ones.

The options arg is `{ virtualWidth?, virtualHeight?, screenInset?, zIndex? }` — every field optional. Omitting the virtual size does **not** disable scaling: a platform default applies (`1920x1080`, or `1600x720` on mobile). The editable aggregator passes no options (`SKILL.md` → **The aggregator**); coded UI passes the size explicitly (`coded-ui.md` → DEFAULT RULE). `screenInset` defaults to `'device'`.

⚠️ **This describes SDK 7.26.0+.** Below 7.26.0 there is no `screenInset` field (passing it is a type error), `virtualWidth` / `virtualHeight` are required when options are passed, and omitting the options means no scaling at all. Check `@dcl/sdk` in the scene's `package.json` — see the version gate in `coded-ui.md`.

## UiEntity — All Props

```tsx
<UiEntity
  uiTransform={{
    // Size
    width: 300,                  // Pixels or '50%'
    height: 200,
    minWidth: 100,
    maxWidth: 500,
    minHeight: 50,
    maxHeight: 400,

    // Position
    positionType: 'absolute',    // 'absolute' | 'relative' (default)
    position: { top: 10, right: 10, bottom: 10, left: 10 },

    // Display
    display: 'flex',             // 'flex' | 'none'

    // Flexbox
    flexDirection: 'column',     // 'row' | 'column'
    justifyContent: 'center',    // 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around'
    alignItems: 'center',        // 'flex-start' | 'center' | 'flex-end' | 'stretch'
    alignContent: 'center',      // cross-axis alignment of wrapped lines
    alignSelf: 'center',         // override parent's alignItems for this element
    flexWrap: 'wrap',            // 'nowrap' | 'wrap'
    overflow: 'scroll',          // 'hidden' | 'visible' | 'scroll'
    flexGrow: 1,                 // Fill remaining space in parent

    // Spacing (values: number px, '50%', '400px', or 'auto'; margin also accepts CSS shorthand '16px 0 8px 270px')
    padding: { top: 10, bottom: 10, left: 10, right: 10 },  // or single number
    margin: { top: 5, bottom: 5, left: 5, right: 5 },       // or single number, or shorthand string

    // Layering
    opacity: 1,                  // 0–1; on the root fades whole UI, cascades multiplicatively to children
    zIndex: 0,                   // stacking among siblings; negatives allowed; does not cross parents (whole renderers: zIndex renderer option)

    // Pointer
    pointerFilter: 'none',       // 'none' (default, clicks pass through) | 'block' (captures clicks over the whole rect, no listener needed)

    // Border (also valid on Button / Input / Dropdown uiTransform)
    borderWidth: 2,
    borderColor: Color4.White(),
    borderRadius: 8              // unsupported on mobile
  }}

  uiBackground={{
    color: Color4.create(0, 0, 0, 0.8),           // Solid color; when combined with texture, acts as a TINT
    texture: { src: 'images/bg.png' },             // Image (src is relative to scene root)
    textureMode: 'stretch',                         // 'stretch' | 'nine-slices' | 'center'
    textureSlices: { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 },  // For nine-slices
    uvs: [0, 0, 0, 1, 1, 1, 1, 0],                  // 8 floats, see Backgrounds
    avatarTexture: { userId: 'user-id' }           // Avatar portrait (use instead of texture)
  }}

  uiText={{                    // coded-only: the editor does not model a text bag on a UiEntity — use a Label child
    value: 'Hello!',
    fontSize: 18,
    color: Color4.White(),
    textAlign: 'middle-center',
    font: 'sans-serif'           // 'sans-serif' | 'serif' | 'monospace'
  }}

  uiInputBinding={{ actions: [InputAction.IA_JUMP] }}  // see uiInputBinding below

  // Events — the complete set; each is () => void, no coordinates, all bound to IA_POINTER
  onMouseDown={() => { }}
  onMouseUp={() => { }}
  onMouseEnter={() => { }}
  onMouseLeave={() => { }}
/>
```

Editable-UI note: in an editable file every value here is a literal or a bare `state.x` / `props.x` reference (`Color4.White()` and `Color4.create(...)` are calls → use `{ r, g, b, a }` literals or a bound color).

## Label

```tsx
<Label
  value="Score: 100"
  fontSize={18}
  color={Color4.White()}
  textAlign="middle-center"
  font="serif"
  textWrap="wrap"
  uiTransform={{ width: 200, height: 30 }}
/>
```

**textAlign values:** `top-left`, `top-center`, `top-right`, `middle-left`, `middle-center`, `middle-right`, `bottom-left`, `bottom-center`, `bottom-right`

**font values:** `sans-serif` (default), `serif`, `monospace`

`value` supports simple markup like `<b>`.

⚠️ **Always give a `Label` an explicit `width` and `height` in `uiTransform`.** Text intrinsic sizing is engine-dependent: the Bevy explorer measures the rendered text and feeds its height into flex layout, the Unity explorer gives an unset dimension ~0 while still drawing the glyphs. So on Unity, labels stacked in a column overlap and any parent auto-sizing from text children collapses to its padding — while the same code looks correct on Bevy. Wrapped text needs a height for its line count (two lines at `fontSize: 20` → 60); a label filling a fixed-size parent can use `width: '100%', height: '100%'`. Containers that stack labels need explicit heights too. Verified in-world with side-by-side screenshots.

⚠️ **Never put emoji in a `value` string.** Emoji glyph coverage depends on the fonts the explorer bundles, and the Unity explorer has no emoji glyphs, so an emoji renders as a missing-glyph box or as nothing at all. Verified in-world: `value="✨ Particles"` showed no sparkle on Unity. Use plain text, and put pictorial affordances in a `uiBackground.texture` on a `UiEntity` beside the label.

## Button

```tsx
<Button
  value="Click Me"
  variant="primary"           // 'primary' | 'secondary'
  fontSize={16}
  color={Color4.White()}      // Text color
  disabled={false}
  uiTransform={{ width: 150, height: 40 }}
  uiBackground={{ color: Color4.Blue() }}  // Override default style
  onMouseDown={() => { console.log('clicked') }}
  onMouseUp={() => { }}
/>
```

A `Button` can also carry a textured background and border props, e.g. a nine-slices image button:

```tsx
<Button
  value="<b>OK</b>"
  textAlign="middle-center"
  fontSize={28}
  color={Color4.White()}
  uiTransform={{ width: 214, height: 74 }}
  uiBackground={{ texture: { src: 'images/ok_button.png' }, textureMode: 'nine-slices' }}
  onMouseDown={() => {}}
/>
```

Alternatively, a plain `UiEntity` with a `Label` child (or `uiText` in coded UI), `uiBackground` and `onMouseDown` behaves as a clickable button without the `Button` component's default styling — this is the shape editable UI uses for hover/press layers.

### `disabled` — what it actually does

- Halves the alpha of the button's text and background colors (visual dimming only).
- Sets `onMouseDown` and `onMouseUp` to `undefined`. **`onMouseEnter` / `onMouseLeave` still pass through** — a disabled Button can still run hover handlers, so guard them yourself if that matters.
- Combined with the pointer-entry removal fix (`@dcl/sdk` 7.28.1+, see **add-interactivity**), a disabled Button ends up with **no `PET_DOWN` `PointerEvents` entry at all**, so the renderer stops advertising the interaction.
- If your code clones palette colors before passing them to a `Button` purely to survive the dimming, that workaround is no longer needed on 7.28.0+. It is still needed if you are pinned below it.

## Input

```tsx
<Input
  placeholder="Enter text..."
  placeholderColor={Color4.Gray()}
  color={Color4.Black()}
  fontSize={16}
  font="sans-serif"
  textAlign="middle-left"
  disabled={false}
  uiTransform={{ width: 250, height: 40 }}           // also accepts borderWidth/borderColor/borderRadius
  uiBackground={{ color: Color4.White() }}
  onChange={(value) => { console.log('Changing:', value) }}
  onSubmit={(value) => { console.log('Submitted:', value) }}
/>
```

- **Not a React controlled component.** `onChange` / `onSubmit` fire with the current value, but the field does not re-read the `value` prop every frame. To clear it programmatically, set `value` to a non-empty sentinel (`' '`) for one frame, then back to `''` (`coded-ui.md` → clear trick). Read typed text from `onChange`, not from a bound `value`.
- **Known issue (client-side, open):** a controlled `Input` **does not follow a programmatic reset.** It displays a value the scene writes, but when the scene later clears it the box keeps showing the old string while the scene's own state is correctly empty — so a form can submit `""` from boxes that still look populated. Follow-on: re-writing the *same* string after such a reset fires **no `onChange` at all**, because the client still believes the box holds it. Verified in `149,149-synthetic-input-showcase` (station S9). Trust your scene state, never the rendered field, and label the read-back value separately if the player needs to see it.
- **`onChange` vs `onSubmit`.** `onChange` fires on edits; `onSubmit` fires on Enter. A submit **commits and clears the field** (as pressing Enter does) — correct behavior, not a bug; a plain edit leaves the text visible. On submit the client emits **`onSubmit` first, then `onChange`** — the reverse of the intuitive order — so a submit also bumps any change counter. A `disabled` `Input` accepts no writes and fires neither callback.
- **Removing an `Input` while it still has keyboard focus is supported.** Deleting the element inside its own `onSubmit` / `onChange` handler (a self-destroying field, a form that closes on submit) is legal: the explorer restores the Player / Camera / Shortcuts input maps that the focus had blocked, so WASD movement and Enter-to-chat come back. Covered by `80,-3-ui`'s `SelfDeletingInputExample` (sdk7-test-scenes `07ba611`). No need to blur or disable first.

## Dropdown

```tsx
<Dropdown
  options={['Option A', 'Option B', 'Option C']}
  selectedIndex={0}
  onChange={(index) => { console.log('Selected:', index) }}
  fontSize={14}
  color={Color4.Black()}
  font="sans-serif"
  textAlign="middle-left"
  uiTransform={{ width: 200, height: 40 }}            // also accepts borderWidth/borderColor/borderRadius
  uiBackground={{ color: Color4.Teal() }}
  acceptEmpty={true}
  emptyLabel="-- Select --"
  disabled={false}
/>
```

`onChange` receives the selected **index**. With `acceptEmpty` the empty entry is index-shifted. Like `Input`, it does not re-read `selectedIndex` every frame; drive it from a module variable / state variable to control it externally (prev/next buttons).

## uiInputBinding (bind InputActions to UI elements)

The `uiInputBinding` prop on `UiEntity` binds `InputAction` values to a UI element so they fire continuously while it is pressed (touch or pointer). This is the primary mechanism for on-screen action buttons on mobile where there is no keyboard.

```tsx
import { InputAction } from '@dcl/sdk/ecs'

<UiEntity
  uiTransform={{ width: 80, height: 80 }}
  uiBackground={{ color: Color4.Red() }}
  uiInputBinding={{ actions: [InputAction.IA_JUMP] }}
/>
```

While the element is held down, `InputAction.IA_JUMP` fires as if the player were pressing the spacebar. Multiple actions can be bound to one element. The underlying ECS component is `PBUiInputBinding { actions: InputAction[] }`. Verified against js-sdk-toolchain commit `82368ee4`.

Combine with `TouchScreenControls` (**advanced-input**) for full mobile control customization: hide the native on-screen buttons, then bind the same actions to your own UI. In a scene that uses the UI Designer's MobileHUD panel, the `TouchScreenControls` config belongs to the panel (`SKILL.md` → **MobileHUD**).

## Backgrounds

Texture `src` paths are relative to the scene root (`'images/panel.png'`), not `src/`. Verified in test scene 70,-9.

```tsx
// image background
<UiEntity uiTransform={{ width: 200, height: 200 }}
  uiBackground={{ textureMode: 'stretch', texture: { src: 'images/logo.png' } }} />

// stretch + tint — color beside texture tints the image; borders deform when the element is non-square
<UiEntity uiTransform={{ width: '50%', height: 244 }}
  uiBackground={{ color: tint, textureMode: 'stretch', texture: { src: 'img.png' } }} />

// nine-slices — borders stay crisp while the center stretches (panels, buttons)
<UiEntity uiTransform={{ width: 256, height: 256 }}
  uiBackground={{ textureMode: 'nine-slices', texture: { src: 'img.png' },
    textureSlices: { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 } }} />

// center — texture drawn at native size, centered
<UiEntity uiTransform={{ width: 300, height: 180 }}
  uiBackground={{ textureMode: 'center', texture: { src: 'img.png' } }} />

// avatar portrait — use avatarTexture instead of texture
<UiEntity uiTransform={{ width: 200, height: 200 }}
  uiBackground={{ textureMode: 'center', avatarTexture: { userId } }} />
```

**Texture UVs.** `uvs` selects a region of a texture: 8 numbers (4 UV pairs) in the order bottom-left, top-left, top-right, bottom-right, values 0–1, with `textureMode: 'stretch'`. A literal crop round-trips in the editor; computed UVs (sprite-sheet helpers, rotation) are in `coded-ui.md`, and in editable UI a driver writes a `number[]` state variable.

```tsx
// Display the left half of a texture
<UiEntity
  uiTransform={{ width: 200, height: 300 }}
  uiBackground={{ textureMode: 'stretch', texture: { src: 'images/card-atlas.png' }, uvs: [0, 0, 0, 1, 0.5, 1, 0.5, 0] }}
/>
```

## Opacity & zIndex (elements)

Verified in test scene `0,6-ui-zindex-and-opacity`. `opacity` (0–1) and `zIndex` (integer, negatives allowed) live on `uiTransform`. Root opacity fades the whole UI and cascades multiplicatively to children. `zIndex` orders overlapping siblings; higher renders on top; it does not cross parent boundaries. Whole renderers stack with the renderer `zIndex` option below.

```tsx
<UiEntity uiTransform={{ width: '100%', height: '100%', opacity: rootOpacity }}>
  <UiEntity
    uiTransform={{
      width: 500, height: 200,
      positionType: 'absolute', position: { top: '50%', left: '45%' },
      margin: { top: -140, left: -250 },   // negative margins to center an absolute box
      zIndex: redZIndex, opacity: redOpacity
    }}
    uiBackground={{ color: Color4.Red() }}
  />
</UiEntity>
```

## screenInset (Renderer-Level Inset — Prefer This in coded UI)

**Requires SDK 7.26.0+.** On older versions the option does not exist and the wrapper components below are the only way to inset UI.

The renderer options select the screen area a UI is positioned in. In coded UI this is the primary mechanism; the `ScreenInsetArea` / `InteractableArea` components are for insetting a single subtree. (The editable aggregator uses the wrapper components structurally, with the renderer at its default — `SKILL.md` → **The aggregator**.)

```ts
type UiScreenInset = 'device' | 'interactable' | 'none'
```

| Value | Area the UI is placed in | Source |
|---|---|---|
| `'device'` **(default)** | Device safe area — excludes notch, status bar, home indicator, rounded corners | `UiCanvasInformation.screenInsetArea` |
| `'interactable'` | Area free of the client's own HUD (minimap, chat, left-side controls). The **bottom-right action buttons are drawn over this area by design** — UI placed there competes for taps | `UiCanvasInformation.interactableArea` |
| `'none'` | Whole screen, `0,0` at top-left | — |

```ts
ReactEcsRenderer.setUiRenderer(MyUI, { virtualWidth: 1920, virtualHeight: 1080 })                        // device safe area (default)
ReactEcsRenderer.setUiRenderer(MyUI, { virtualWidth: 1920, virtualHeight: 1080, screenInset: 'interactable' })  // clear of client HUD
ReactEcsRenderer.setUiRenderer(MyUI, { screenInset: 'none' })                                             // whole screen
ReactEcsRenderer.addUiRenderer(owner, MyWidget, { screenInset: 'interactable' })                          // per-renderer, independent of main UI
```

- Applied **per renderer**: the main UI and each `addUiRenderer` widget can use different areas simultaneously. (Contrast with the virtual size, which is scene-wide.)
- Re-read every tick, so the UI follows the insets on rotation or when system bars appear/hide.
- On desktop the device insets are zero, so `'device'` behaves like `'none'` there.
- Inset values are reported in canvas pixels and are compensated for the UI scale factor internally, so they stay correct at any virtual screen size.
- **An inset does not clip.** `ScreenInsetArea` / `InteractableArea` are absolutely-positioned containers at the inset margins and set **no `overflow`** (Yoga defaults to visible), so a child positioned beyond the inset renders *into* the reserved zone rather than being cut off. The inset is a layout origin, not a mask — an absolutely-positioned element with a negative offset, or one larger than the area, will still collide with the notch or the game HUD. Do not rely on the inset to hide overflow, and do not add `overflow: 'hidden'` to hide it either: the overflow is the signal that a node is mis-placed. The Creator Hub UI Editor's mobile preview deliberately shows this overflow for the same reason.
- **Never stack a wrapper on the matching renderer inset.** A `<ScreenInsetArea>` inside a renderer already using `'device'` applies the margin twice, pushing the UI inwards by double the amount. Rely on `screenInset`, or pass `screenInset: 'none'` and place the wrapper yourself.

## Renderer zIndex (Stacking Between Renderers)

SDK 7.29.0+. Renderers stack in the order they first render, the latest on top; among those first rendered in the same tick (everything registered before the first frame, typically) the main UI goes at the back, then the added ones in order. The `zIndex` renderer option puts a whole renderer in front of or behind the others regardless of that. **`0` is interpreted as "unset"** and keeps the default positional order — so `0` is not "the bottom layer"; use a negative value to push a renderer behind the others.

```ts
ReactEcsRenderer.setUiRenderer(MainHud, { zIndex: -10 })          // behind every module
ReactEcsRenderer.addUiRenderer(owner, Inventory, { zIndex: 10 })  // in front, however early it was registered
ReactEcsRenderer.addUiRenderer(owner, Inventory, { zIndex: 20 })  // same owner: replaced in place, new zIndex applied
```

- Per renderer, on `setUiRenderer` and `addUiRenderer` alike. Re-register the same owner entity with new options to change it at runtime — the renderer keeps its place.
- Orders renderers against each other only; `uiTransform.zIndex` inside a renderer keeps ordering its own siblings.
- Applied to the renderer's root container. With `screenInset: 'none'` a whole-screen root is added to carry it, so the renderer's own root becomes a child of it.
- **Budget the top of the stack for the Admin Tools smart item.** A scene that includes it gets the admin toolkit UI from `@dcl/asset-packs` as an additional renderer at **renderer `zIndex: 1000`**, rendered through the scene's own `ReactEcsRenderer`, so its toggle button stays above scene UI. Keep scene renderers below 1000 unless you deliberately want to cover that button. Before `@dcl/asset-packs` 2.21.1 / creator-hub#1612, asset-packs created a *second* react-ecs system on the same engine; both chained their roots from `rightOf: 0`, the explorer followed only one chain, and **every renderer `zIndex` in the scene was silently ignored**. If renderer stacking does nothing in a scene with Admin Tools, check the asset-packs version first.
- **Raw-ECS `UiTransform` siblings:** react-ecs always chains siblings through `rightOf`, so a parent normally has exactly one child with `rightOf: 0`. Scenes that create `UiTransform` directly may leave `rightOf` at its default on every child, giving a parent several "heads" — those siblings keep **creation order** and each still honours its own `zIndex`. Removing and re-adding one makes it the newest child. `PBUiTransform` has **no partial form**: every field is required, so a raw component must spell out the whole proto-default object and override from there.

## ScreenInsetArea (Mobile Hardware-Safe Region)

Wraps children so they stay inside the device's hardware-reserved margins — notch, status bar, home indicator, rounded corners. Mobile-only effect: on desktop the insets are `(0,0,0,0)`, so the wrapper has no effect and is safe to leave in cross-platform UI. Reacts automatically to insets reported by the device (rotation, system bars appearing/hiding).

**In coded UI on SDK 7.26.0+ you usually do not need this component** — `screenInset` already defaults to `'device'`, which insets the whole renderer. Use it only to inset one subtree while the renderer uses `screenInset: 'none'`. **Below 7.26.0 this component is the only mechanism available**, so wrapping is the correct pattern there and there is no double-application to worry about (ignore the `screenInset` argument in the snippet below). The editable aggregator uses it as the per-root wrapper with the renderer at its default — see `SKILL.md` → **The aggregator** for the consequence.

⚠️ **Never stack it on the matching renderer inset** in hand-written renderers. That is why the snippet below passes `screenInset: 'none'`.

The component sets its own `positionType: 'absolute'` and `position` from the device insets — those two fields in `uiTransform` are reserved and ignored. All other `uiTransform`, `uiBackground`, and event props are forwarded normally.

```tsx
import ReactEcs, { ReactEcsRenderer, UiEntity, ScreenInsetArea } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(() => (
    <ScreenInsetArea
      uiTransform={{
        // positionType and position are reserved — any values here are ignored
        padding: 10,
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      {/* A child sized 100%×100% fills the safe area exactly */}
      <UiEntity
        uiTransform={{ width: '100%', height: '100%' }}
        uiBackground={{ color: Color4.create(0, 0, 0, 0.5) }}
      />
    </ScreenInsetArea>
    // 'none' so the component's inset is not applied on top of the renderer's default
  ), { virtualWidth: 1920, virtualHeight: 1080, screenInset: 'none' })
}
```

It auto-compensates for the UI scale factor (pre-divides insets so the parser's scale multiplication cancels out), so insets are correct regardless of virtual screen size.

**Hardware insets vs. Decentraland system HUD:** `ScreenInsetArea` (and `screenInset: 'device'`) only covers the physical device's reserved regions. It does *not* avoid Decentraland's on-screen controls — keep those clear manually on mobile: the joystick sits on the left, the chat/profile/camera buttons on the top-right, and the interaction button on the bottom-right of the canvas. The *input* controls among those (joystick, crosshair, gamepad buttons) can also be hidden outright with `TouchScreenControls` on SDK 7.26.0+ — see **advanced-input**. The client's own HUD (chat, profile, emote wheel) cannot.

Do **not** apply the old "scale sizes ~3× for mobile" rule of thumb on 7.26.0+: with `devicePixelRatio` out of the scale factor, pixel-sized UI is already ~2–3× larger on a phone than it used to be, and the `1600x720` mobile virtual screen adds ~1.2× on top. Start from the desktop sizes and only scale up what actually measures too small on a device.

## InteractableArea (Client-UI-Safe Region)

Wraps children so they stay inside the renderer-reported **interactable area** — the portion of the screen *not* covered by the client's own UI (minimap, chat window, and other platform overlays). Reads `UiCanvasInformation.interactableArea` and constrains children to it via absolute positioning.

**For a whole coded UI, prefer `screenInset: 'interactable'` on the renderer.** Use the component to inset a single subtree, or when the renderer sits in a different area. In the editable aggregator it is the wrapper for roots whose Scene Inset is `interactable`.

⚠️ **Client support.** Either form needs an explorer that reports the area. It works on desktop, and on mobile from client version `1.12.1` onwards — older mobile clients report no margins, so the area falls back to the whole screen and the inset silently does nothing. `1.12.1` is also the release that normalizes the `'device'` area between Android and iOS, so treat it as the floor for any inset-sensitive mobile layout.

```tsx
import ReactEcs, { ReactEcsRenderer, UiEntity, InteractableArea } from '@dcl/sdk/react-ecs'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(() => (
    <InteractableArea>
      {/* A child sized 100%×100% fills the interactable area exactly */}
      <UiEntity uiTransform={{ width: '100%', height: '100%' }} />
    </InteractableArea>
    // 'none' so the renderer's default 'device' inset is not stacked under this wrapper
  ), { screenInset: 'none' })
}
```

- Types: `function InteractableArea(props: UiInteractableAreaProps)`; `UiInteractableAreaProps = Omit<EntityPropTypes, 'uiTransform'> & { uiTransform?: Omit<NonNullable<EntityPropTypes['uiTransform']>, 'positionType' | 'position'> }`. Import from `@dcl/sdk/react-ecs`.
- The component owns `positionType: 'absolute'` and `position` (set from the reported insets) — any values you pass for those in `uiTransform` are **ignored**. All other `uiTransform`, `uiBackground`, and event props forward normally.
- On the **Unity desktop client** the left ~25% of the screen is reserved for client UI, so children are placed within the remaining ~75%. It excludes the **left column only** — it shares its right edge with the device area, so the bottom-right action cluster sits inside it.
- Falls back to zero insets (no-op) when `UiCanvasInformation` is unavailable.
- **Distinct from `ScreenInsetArea`:** `InteractableArea` avoids the *client's* UI; `ScreenInsetArea` avoids the *device's* hardware margins. They read different sources and can be nested to apply both (the renderer's `screenInset` picks only one).

## UiCanvasInformation (Responsive Design)

Fields: `width`, `height`, `devicePixelRatio` (all numbers), plus `screenInsetArea` and `interactableArea` (`BorderRect` — `top` / `bottom` / `left` / `right`). `devicePixelRatio` is a display-density hint, useful for picking a 1x/2x/3x texture; it does not take part in UI layout.

⚠️ **`width` and `height` are RAW canvas pixels, not virtual/scaled units** — the SDK derives the UI scale factor from them (`Math.min(width / virtualWidth, height / virtualHeight)`), so they cannot already be scaled. The two `BorderRect`s are raw canvas pixels too. They are the right input for *decisions* (which layout, which texture resolution), not for computing sizes — the renderer already scales pixel values for you.

```typescript
import { UiCanvasInformation, engine } from '@dcl/sdk/ecs'

const canvasInfo = UiCanvasInformation.get(engine.RootEntity)   // throws if not yet present
const canvasInfoSafe = UiCanvasInformation.getOrNull(engine.RootEntity) // null-safe
```

Read it in a system (touching `engine.RootEntity` during initial scene load can error). The coded responsive pattern (test scene 76) is in `coded-ui.md`; in editable UI the driver writes the resulting px into a state variable.

## Example scenes

Engine-team test scenes exercised against the real renderer (ground truth for the APIs above):

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,6-ui-zindex-and-opacity — `zIndex` (incl. negative) and `opacity` on `uiTransform`, including root-level opacity cascade; buttons cycle values. Also the `zIndex` *renderer option* in `src/renderer-stacking.tsx`: three overlapping rectangles, one per `addUiRenderer` (registered A→B→C with zIndex 20/10/0, so A is in front despite being first), each re-registered on the same owner entity with the next value from `[-20,-10,0,10,20]` when its button is clicked. A fourth renderer added with no options sits on top by registration order alone. `src/admin-toolkit-stacking.tsx` covers the Admin Tools smart item at renderer zIndex 1000; `src/raw-siblings.tsx` covers raw `UiTransform` siblings created with no `rightOf` (creation order + per-element `zIndex`, incl. remove/re-add), and shows the full proto-default `PBUiTransform` a raw component needs.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/70,-9-sdk7-ui-backgrounds — every `uiBackground` texture mode (`stretch`, `nine-slices`, `center`), color tinting over textures, `avatarTexture`, and `textureSlices`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/80,-3-ui — `Label` / `Input` / `Dropdown` / `Button` end to end, `uiText` on `UiEntity`, `margin` CSS-shorthand strings, `'auto'` sizing, `UiCanvasInformation`, `SelfDeletingInputExample`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/81,-3-ui-2 — array-return of stacked panels, `disabled` toggling, border props (`borderWidth` / `borderColor` / `borderRadius`) on Input/Dropdown/Button, uncontrolled-input clear trick, textured `Button` (nine-slices) vs. clickable `UiEntity`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/76,-10-UiCanvasInformation — reading `UiCanvasInformation` each frame into a module variable to size UI responsively.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/81,-2-ui-screen-inset-area — the three `screenInset` modes of `setUiRenderer` / `addUiRenderer` (`'none'`, `'device'`, `'interactable'`) as three coexisting renderers, each framing the area it is positioned in and printing the live `UiCanvasInformation.screenInsetArea` / `.interactableArea` values.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,7-portable-experience-hide-ui — hiding a portable experience's UI via `featureToggles.portableExperiences: "hideUi"` in `scene.json` (scene-config, not React-ECS).
