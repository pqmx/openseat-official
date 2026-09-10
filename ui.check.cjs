// Render the real components/hooks with native surfaces replaced by host elements.
// This checks state transitions; it does not substitute for device layout tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve=yes; reject=no; }); return { promise, resolve, reject }; };
const surfaces = new Proxy({}, { get: (_target, name) => name === '__esModule' ? true : String(name) });
const alerts = [];
const navigation = [];
const appListeners = new Set();
const native = { ...Object.fromEntries(['View','Text','TextInput','Pressable','ScrollView','FlatList','KeyboardAvoidingView','ActivityIndicator'].map((name)=>[name,name])),
  StyleSheet: { absoluteFill: {}, create: (v)=>v }, Platform: { OS:'ios' },
  useColorScheme: ()=>'light', useWindowDimensions: ()=>({height:844,width:390}),
  Alert: { alert: (...args)=>alerts.push(args) }, Share: { share: async (value)=>navigation.push(value) },
  Linking: { openURL:async(value)=>navigation.push(value) },
  AppState: { currentState:'active', addEventListener:(_event,fn)=>{ appListeners.add(fn); return {remove:()=>appListeners.delete(fn)}; } },
};
const router = Object.fromEntries(['push','replace','dismiss','back','navigate'].map((name)=>[name,(...args)=>navigation.push([name,...args])]));
const color = new Proxy({}, { get:()=> '#333333' });
const theme = { useTheme:()=>({c:color}), font:{regular:'sans',medium:'sans',bold:'sans'}, radius:{}, type:{}, em:(_a,b)=>b };
const baseMocks = {
  'react-native':native,
  'expo-router':{router, useFocusEffect:(fn)=>React.useEffect(fn,[fn]), useLocalSearchParams:()=>({}), Redirect:'Redirect'},
  '@sentry/react-native': {captureException:()=>{}},
  'expo-haptics':{impactAsync:async()=>{},notificationAsync:async()=>{},ImpactFeedbackStyle:{Light:1},NotificationFeedbackType:{Error:1}},
  'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:59,bottom:34,left:0,right:0})},
  'react-native-maps':{__esModule:true,default:'MapView',Marker:'Marker',Circle:'Circle'},
  'react-native-reanimated':{__esModule:true,default:{View:'AnimatedView',FlatList:'AnimatedFlatList'},useAnimatedRef:()=>React.useRef(null)},
  '../theme':theme,'./theme':theme,
  '../components/icons':surfaces,
  '../components/ui':surfaces,
  './ui':surfaces,
  '../components/rooms':surfaces,
  '../components/sheet':{BottomSheet:'BottomSheet'},
  '../prefs':{getMapsApp:async()=>undefined,setMapsApp:async()=>{}},
};
const compiled = new Map();
function loader(overrides={}) {
  const mocks={...baseMocks,'../feedback':baseFeedback,...overrides}; const modules=new Map();
  function load(filename) {
    filename=path.resolve(__dirname,filename);
    if (!path.extname(filename)) filename += fs.existsSync(filename+'.ts')?'.ts':'.tsx';
    if (modules.has(filename)) return modules.get(filename).exports;
    const module={exports:{}}; modules.set(filename,module);
    let code=compiled.get(filename);
    if (!code) { code=babel.transformFileSync(filename,{babelrc:false,configFile:false,presets:['babel-preset-expo'],plugins:['@babel/plugin-transform-modules-commonjs']}).code; compiled.set(filename,code); }
    const req=(name)=>Object.hasOwn(mocks,name)?mocks[name]:name.startsWith('.')?load(path.resolve(path.dirname(filename),name)):require(name);
    vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename})(req,module,module.exports);
    return module.exports;
  }
  return load;
}
const person={id:'11111111-1111-4111-8111-111111111111',name:'Test Student',short:'Test',initials:'TS',year:"'30",major:'',interests:[],prompts:[]};
const room={id:'22222222-2222-4222-8222-222222222222',title:'Test room',place:'Powell',host:person,startsAt:new Date(),endsAt:new Date(Date.now()+14400000),access:'approve',capacity:4,attendees:[person],requests:[],updates:[],lat:34,lng:-118,approxLat:34,approxLng:-118};
const baseApi={useNow:()=>new Date()};
const baseFeedback={useWrite:()=>({busy:false,run:async(fn)=>{await fn();return true;}}),tapOk:()=>{},tapFail:()=>{}};
const findButton=(tree,label)=>tree.root.findAll((node)=>typeof node.type==='string' && node.props.label===label)[0];

async function main() {
  // Real resource hook: auth changes, stale responses, refresh failures, focus,
  // foreground refresh, and mutation invalidation. No live Supabase is touched.
  let authChange, resourceState, focused = true;
  const reads = [];
  const timers = new Set();
  const realSetInterval = global.setInterval, realClearInterval = global.clearInterval;
  global.setInterval = (fn) => { timers.add(fn); return fn; };
  global.clearInterval = (fn) => timers.delete(fn);
  const resource = loader({
    './supabase': { supabase: { auth: { onAuthStateChange: (fn) => { authChange = fn; } } } },
    'expo-router': { useFocusEffect: (fn) => React.useEffect(() => focused ? fn() : undefined, [fn, focused]) },
  })('room-resource.ts');
  const fetchValue = () => { const d = deferred(); reads.push(d); return d.promise; };
  function ResourceHarness() { resourceState = resource.useRoomResource('test', fetchValue); return null; }
  let resourceTree;
  try {
    await act(async () => { resourceTree = create(React.createElement(ResourceHarness)); });
    assert.equal(reads.length, 0, 'signed-out screens never fetch');
    await act(async () => authChange('SIGNED_IN', { user: { id: 'alice' } }));
    assert.equal(reads.length, 1);
    await act(async () => authChange('SIGNED_IN', { user: { id: 'bob' } }));
    assert.equal(resourceState.data, undefined);
    await act(async () => reads[0].resolve('alice private room'));
    assert.equal(resourceState.data, undefined, 'old account response is discarded');
    await act(async () => reads[1].resolve('bob room'));
    assert.equal(resourceState.data, 'bob room');
    await act(async () => { for (const fn of timers) fn(); });
    await act(async () => reads[2].reject(Error('offline')));
    assert.equal(resourceState.data, 'bob room', 'failed polling keeps the cached screen');
    assert.ok(resourceState.error);
    native.AppState.currentState = 'background';
    await act(async () => { for (const fn of timers) fn(); });
    assert.equal(reads.length, 3, 'background screens do not poll');
    native.AppState.currentState = 'active';
    await act(async () => { for (const fn of appListeners) fn('active'); });
    await act(async () => reads[3].resolve('reconnected'));
    assert.equal(resourceState.error, undefined);
    await act(async () => resource.invalidateRooms());
    await act(async () => reads[4].resolve('after mutation'));
    assert.equal(resourceState.data, 'after mutation');
    focused = false;
    await act(async () => resourceTree.update(React.createElement(ResourceHarness)));
    assert.equal(timers.size, 0, 'hidden screens remove their poll timer');
    assert.equal(appListeners.size, 0, 'hidden screens remove foreground listeners');
    await act(async () => authChange('SIGNED_OUT', null));
    assert.equal(resourceState.data, undefined, 'sign-out clears private content');
  } finally {
    await act(async () => resourceTree?.unmount());
    global.setInterval = realSetInterval;
    global.clearInterval = realClearInterval;
    native.AppState.currentState = 'active';
  }

  // The actual API sends scoped cursor queries and directly fetches deep-linked
  // details; cursor timestamps keep database microseconds, not JS millisecond rounding.
  const queryCalls = [];
  const raw = (i) => ({ id: String(i), starts_at: '2026-09-07T01:00:00.123456+00:00',
    capacity: 10, attendee_count: 8, host: null, members: [], updates: [] });
  const db = {
    rpc: async (name, args) => { queryCalls.push([name, args]); return { data: Array.from({ length: 41 }, (_, i) => raw(i)) }; },
    from: (name) => {
      queryCalls.push(['from', name]);
      const builder = Object.fromEntries(['select', 'eq', 'order', 'limit'].map((method) => [method, (...args) => { queryCalls.push([method, ...args]); return builder; }]));
      builder.maybeSingle = async () => ({ data: raw(123) });
      return builder;
    },
  };
  const queries = loader({ './supabase': { supabase: db }, './room-resource': {} })('api.ts');
  const page = await queries.fetchRoomPage({ scope: 'mine' });
  assert.equal(page.rooms.length, 40);
  assert.equal(page.rooms[0].attendeeCount, 8);
  assert.equal(page.next.at, '2026-09-07T01:00:00.123456+00:00');
  await queries.fetchRoomPage({ scope: 'mine' }, page.next);
  assert.equal(queryCalls.at(-1)[1].p_cursor_id, '39');
  assert.equal(queryCalls.at(-1)[1].p_scope, 'mine');
  await queries.fetchRoom('not-in-feed');
  assert.ok(queryCalls.some((call) => call[0] === 'eq' && call[1] === 'id' && call[2] === 'not-in-feed'));
  assert.ok(queryCalls.some((call) => call[0] === 'limit' && call[1] === 20));

  // Actual useWrite: two synchronous invocations must perform one operation,
  // and an error must release the lock for a subsequent attempt.
  const feedback=loader()('feedback.ts');
  let write;
  function Harness(){write=feedback.useWrite();return null;}
  let tree; await act(async()=>{tree=create(React.createElement(Harness));});
  const pending=deferred();let operations=0;let first,second;
  await act(async()=>{first=write.run(()=>{operations++;return pending.promise;});second=write.run(()=>{operations++;return Promise.resolve();});});
  assert.equal(operations,1);assert.equal(await second,false);
  await act(async()=>{pending.resolve();await first;});
  await act(async()=>{assert.equal(await write.run(async()=>{throw new Error('secret backend detail');}),false);});
  assert.ok(!JSON.stringify(alerts.at(-1)).includes('secret backend detail'));
  await act(async()=>{assert.equal(await write.run(async()=>{}),true);tree.unmount();});

  // Profile editing stays local, preserves whitespace, and saves both fields
  // in one explicit operation. A failed save keeps the unsaved draft.
  const writes=[]; let failure=true;
  const profileApi={...baseApi,fetchBlocks:async()=>[],saveProfile:async(id,patch)=>{writes.push(patch);if(failure)throw Error('offline');}};
  const profile=loader({'../api':profileApi,'../feedback':feedback,'../session':{useSession:()=>({reloadMe:async()=>{},signOut:async()=>{},deleteAccount:async()=>{}})}})('screens/Profile.tsx');
  await act(async()=>{tree=create(React.createElement(profile.YourProfile,{me:person,rooms:[]}));});
  const fields=()=>tree.root.findAllByType('TextInput').filter((node)=>node.props.multiline);
  await act(async()=>{fields()[0].props.onChangeText('Coffee with friends ');fields()[1].props.onChangeText('Study groups');});
  assert.equal(fields()[0].props.value,'Coffee with friends ');
  assert.equal(writes.length,0,'editing does not send autosaves');
  await act(async()=>{await findButton(tree,'Save profile').props.onPress();});
  assert.equal(fields()[1].props.value,'Study groups','failure preserves draft');
  failure=false;
  await act(async()=>{await findButton(tree,'Save profile').props.onPress();});
  assert.deepEqual(writes.at(-1).prompts.map((p)=>p.a),['Coffee with friends','Study groups']);
  await act(async()=>tree.unmount());

  // Places: query changes invalidate the selected coordinates. Slow, aborted
  // selection A must not overwrite a newer selection B even if fetch ignores abort.
  const lookups=[];
  const createApi={...baseApi,searchPlaces:async()=>[{id:'a',title:'Place A',sub:'A'},{id:'b',title:'Place B',sub:'B'}],
    resolvePlace:(id)=>{const d=deferred();lookups.push({id,...d});return d.promise;}};
  const createScreen=loader({'../api':createApi})('screens/Create.tsx');
  await act(async()=>{tree=create(React.createElement(createScreen.CreateStep1));});
  await act(async()=>{tree.root.findByProps({testID:'create-title'}).props.onChangeText('Study');tree.root.findByProps({testID:'create-location'}).props.onChangeText('Place');});
  await act(async()=>{await new Promise((resolve)=>setTimeout(resolve,180));});
  const rows=()=>tree.root.findAll((node)=>node.type==='Pressable' && node.props.accessibilityState && Object.hasOwn(node.props.accessibilityState,'selected'));
  let a,b;
  await act(async()=>{a=rows()[0].props.onPress();b=rows()[1].props.onPress();});
  assert.equal(findButton(tree,'Next: when & who').props.disabled,true);
  await act(async()=>{lookups[1].resolve({lat:2,lng:2});await b;lookups[0].resolve({lat:1,lng:1});await a;});
  await act(async()=>findButton(tree,'Next: when & who').props.onPress());
  assert.equal(navigation.at(-1)[1].params.place,'Place B');
  await act(async()=>tree.root.findByProps({testID:'create-location'}).props.onChangeText('Different'));
  assert.equal(findButton(tree,'Next: when & who').props.disabled,true);
  await act(async()=>tree.unmount());

  // Both host variants expose the real closing action and a room link. Pending
  // members see withdrawal; neither view promises push or private addresses.
  const closed=[];
  const roomApi={...baseApi,endRoom:async(...args)=>closed.push(args)};
  const roomScreen=loader({'../api':roomApi,'../session':{useSession:()=>({me:person})}})('screens/Room.tsx');
  for (const name of ['RoomHost','RoomHostRequests']) {
    await act(async()=>{tree=create(React.createElement(roomScreen[name],{room,rooms:[],reload:async()=>{}}));});
    await act(async()=>findButton(tree,'End room').props.onPress());
    const confirm=alerts.at(-1)[2].find((button)=>button.style==='destructive');
    await act(async()=>{confirm.onPress();});
    assert.deepEqual(closed.at(-1),[room.id,false]);
    await act(async()=>findButton(tree,'Share').props.onPress());
    assert.ok(navigation.at(-1).message.includes('openseat://room/'+room.id));
    const text=JSON.stringify(tree.toJSON());
    assert.ok(!/Pings all|Nobody sees the address|You'll get a ping/.test(text));
    await act(async()=>tree.unmount());
  }
  const guest={...person,id:'guest'};
  // Completing a post must not erase text edited while the request was pending.
  const posts = [];
  const composerScreen = loader({'../feedback': feedback, '../api': {...baseApi,
    postUpdate: async (_roomId, _personId, text) => {
      const request = deferred(); posts.push({text, ...request}); return request.promise;
    }}, '../session': {useSession: () => ({me: person})}})('screens/Room.tsx');
  await act(async () => { tree = create(React.createElement(composerScreen.RoomHost, {room, rooms: [], reload: async () => {}})); });
  const composer = () => tree.root.findByType('TextInput');
  await act(async () => composer().props.onChangeText('First update'));
  await act(async () => findButton(tree, 'Post update').props.onPress());
  assert.equal(posts[0].text, 'First update');
  await act(async () => composer().props.onChangeText('New draft'));
  await act(async () => posts[0].resolve());
  assert.equal(composer().props.value, 'New draft', 'posting preserves subsequent edits');
  await act(async () => findButton(tree, 'Post update').props.onPress());
  await act(async () => posts[1].reject(Error('offline')));
  assert.equal(composer().props.value, 'New draft', 'failed posts preserve the draft');
  await act(async () => findButton(tree, 'Post update').props.onPress());
  await act(async () => posts[2].resolve());
  assert.equal(composer().props.value, '', 'successful posts clear an unchanged draft');
  await act(async () => tree.unmount());

  const memberScreen=loader({'../api':{...baseApi,leaveRoom:async(...args)=>closed.push(args)},'../session':{useSession:()=>({me:guest})}})('screens/Room.tsx');
  await act(async()=>{tree=create(React.createElement(memberScreen.Room,{room:{...room,requests:[guest]},rooms:[],reload:async()=>{}}));});
  await act(async()=>findButton(tree,'Withdraw request').props.onPress());
  assert.deepEqual(closed.at(-1),[room.id,'guest']);
  await act(async()=>tree.unmount());

  // An empty live feed still exposes every time tab and an upcoming-room action.
  const feedQueries=[];
  const discover=loader({'../api':{...baseApi,useRooms:(q)=>{feedQueries.push(q);return {rooms:[],loading:false,refreshing:false,reload:()=>{},hasMore:false};}}})('screens/Discover.tsx');
  await act(async()=>{tree=create(React.createElement(discover.Discover));});
  assert.ok(findButton(tree,'See upcoming rooms'));
  await act(async()=>findButton(tree,'See upcoming rooms').props.onPress());
  assert.equal(feedQueries.at(-1).window,'This week');
  await act(async()=>tree.unmount());
  console.log('UI regressions passed: account isolation, focus/poll/foreground lifecycle, scoped API queries, write lock, profile save/retry, Places races, both host controls, update draft preservation, room links, withdrawal, and empty-feed navigation');
}
main().catch((error)=>{console.error(error);process.exitCode=1;});
