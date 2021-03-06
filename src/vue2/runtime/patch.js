import {
  TEXT_VNODE,
  ELEMENT_VNODE,
  COMPONENT_VNODE
} from './create-element.js'

import { camelize } from './helper.js'

const cbs = [
  updateStaticStyle,
  updateAttributes,
  updateDOMListeners
];

export default function patch(oldVNode, vnode, mountEl) {
  if (!oldVNode) {
    // 初始化挂载
    createElm(vnode, mountEl);
  } else if (sameVNode(oldVNode, vnode)) {
    // 两个vnode相同，走patch
    patchVnode(oldVNode, vnode);
  } else {
    // 两个vnode不同，创建新的，删除旧的
    let parentElm = mountEl.parentNode;
    createElm(vnode, parentElm);
    removeVnode(oldVNode);
  }
  return vnode.elm;
}

function patchVnode(oldVNode, vnode) {
  let elm = vnode.elm = oldVNode.elm;
  let oldCh = oldVNode.children;
  let ch = vnode.children;
  if (vnode.tag && vnode.data) {
    cbs.forEach(cb => {
      cb(vnode, oldVNode);
    });
  }
  if (oldVNode.type === TEXT_VNODE && vnode.type === TEXT_VNODE) {
    if (oldVNode.text !== vnode.text) {
      elm.textContent = vnode.text;
    }
  } else if (oldVNode.type === TEXT_VNODE || vnode.type === TEXT_VNODE) {
    let parentElm = elm.parentNode;
    createElm(vnode, parentElm, elm);
    removeVnode(oldVNode);
  } else if (oldVNode.type !== TEXT_VNODE && vnode.type !== TEXT_VNODE) {
    if (oldCh && ch) {
      if (oldCh !== ch) updateChildren(elm, oldCh, ch);
    } else if (oldCh) {
      removeVnodes(oldCh, 0, oldCh.length - 1);
    } else if (ch) {
      addVnodes(ch, 0, ch.length - 1, elm);
    }
  }
}

function updateChildren(parentElm, oldCh, newCh) {
  // 双端比较法
  let newStartIdx = 0;
  let newEndIdx = newCh.length - 1;
  let oldStartIdx = 0;
  let oldEndIdx = oldCh.length - 1;
  let newStartVnode = newCh[newStartIdx];
  let newEndVnode = newCh[newEndIdx];
  let oldStartVnode = oldCh[oldStartIdx];
  let oldEndVnode = oldCh[oldEndIdx];
  let oldKeyToIdx, newIdxInOld;

  while (newStartIdx <= newEndIdx && oldStartIdx <= oldEndIdx) {
    if (!oldEndVnode) {
      oldEndVnode = oldCh[--oldEndIdx];
    } else if (!oldStartVnode) {
      oldStartVnode = oldCh[++oldStartIdx];
    } else if (sameVNode(oldStartVnode, newStartVnode)) {
      // 头头
      patchVnode(oldStartVnode, newStartVnode);
      newStartVnode = newCh[++newStartIdx];
      oldStartVnode = oldCh[++oldStartIdx];
    } else if (sameVNode(oldEndVnode, newEndVnode)) {
      // 尾尾
      patchVnode(oldEndVnode, newEndVnode);
      newEndVnode = newCh[--newEndIdx];
      oldEndVnode = oldCh[--oldEndIdx];
    } else if (sameVNode(oldEndVnode, newStartVnode)) {
      // 头尾
      patchVnode(oldEndVnode, newStartVnode);
      insertBefore(oldEndVnode.elm, parentElm, oldStartVnode.elm);
      newStartVnode = newCh[++newStartIdx];
      oldEndVnode = oldCh[--oldEndIdx];
    } else if (sameVNode(oldStartVnode, newEndVnode)) {
      // 尾头
      patchVnode(oldStartVnode, newEndVnode);
      insertBefore(oldStartVnode.elm, parentElm, oldEndVnode.elm.nextSibling);
      oldStartVnode = oldCh[++oldStartIdx];
      newEndVnode = newCh[--newEndIdx];
    } else {
      // 以上均不满足
      // 找到新节点在旧节点中的下标：
      // 若存在，且符合sameVnode，进行patchVnode，旧节点置为undefined
      //        不符合sameVnode，创建新节点
      // 若不存在，创建新节点
      // newStartIdx++
      if (!oldKeyToIdx) oldKeyToIdx = createOldKeyToIdx(oldCh, oldStartIdx, oldEndIdx);
      newIdxInOld = newStartVnode.key
        ? oldKeyToIdx[newStartVnode.key]
        : findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx);
      if (isUndef(newIdxInOld)) {
        createElm(newStartVnode, parentElm, oldStartVnode.elm);
      } else {
        let vnodeToOld = oldCh[newIdxInOld];
        if (sameVNode(vnodeToOld, newStartVnode)) {
          patchVnode(vnodeToOld, newStartVnode);
          insertBefore(vnodeToOld.elm, parentElm, oldStartVnode.elm);
          oldCh[newIdxInOld] = undefined;
        } else {
          createElm(newStartVnode, parentElm, oldStartVnode.elm);
        }
      }
      newStartVnode = newCh[++newStartIdx];
    }
  }
  if (oldEndIdx >= oldStartIdx) {
    // 还有剩下的旧节点，全部删除
    removeVnodes(oldCh, oldStartIdx, oldEndIdx);
  } else if (newEndIdx >= newStartIdx) {
    // 还有剩下的新节点，全部新增
    let refElm = newCh[newEndIdx + 1] ? newCh[newEndIdx + 1].elm : null;
    addVnodes(newCh, newStartIdx, newEndIdx, parentElm, refElm);
  }
}

function addVnodes(children, startIdx, endIdx, parentElm, refElm) {
  for (let i = startIdx; startIdx <= endIdx; i++) {
    createElm(children[i], parentElm);
  }
}

function removeVnodes(children, startIdx, endIdx) {
  for (let i = startIdx; i <= endIdx; i++) {
    let vnode = children[i];
    if (vnode.tagName) {
      removeVnodeListener(vnode);
      removeVnode(vnode);
    } else {
      removeVnode(vnode);
    }
  }
}

function removeVnodeListener(vnode) {
  const data = vnode.data;
  if (typeof data !== 'object' || data === null) {
    return;
  }
  Object.keys(data).forEach(key => {
    if (key === 'on') {
      Object.keys(data[key]).forEach(eventName => {
        vnode.elm.removeEventListener(eventName, data[key][eventName].bind(vnode.context))
      });
    }
  });
}

function removeVnode(vnode) {
  let parentNode = vnode.elm.parentNode;
  parentNode.removeChild(vnode.elm);
}

function isUndef(a) {
  return a === void 0 || a === null;
}

function findIdxInOld(vnode, children, startIdx, endIdx) {
  for (let i = startIdx; i <= endIdx; i++) {
    if (!isUndef(children[i]) && sameVNode(vnode, children[i])) return i;
  }
}

function createOldKeyToIdx(children, startIdx, endIdx) {
  let map = {};
  for (let i = startIdx; i <= endIdx; i++) {
    if (typeof children[i].key !== "undefined" && children[i].key !== null) {
      map[children[i].key] = i;
    }
  }
  return map;
}

function sameVNode(vnode1, vnode2) {
  return vnode1.key === vnode2.key && vnode1.type === vnode2.type
}

function createElm(vnode, parentEl, refElm) {
  if (vnode.tag) {
    vnode.elm = document.createElement(vnode.tag);
    if (vnode.data) {
      cbs.forEach(cb => {
        cb(vnode);
      });
    }
    if (vnode.children) {
      createChildren(vnode, vnode.children);
    }
    insertBefore(vnode.elm, parentEl, refElm);
  } else if (vnode.type === TEXT_VNODE) {
    vnode.elm = document.createTextNode(vnode.text);
    insertBefore(vnode.elm, parentEl, refElm);
  }
}

function insertBefore(el, parent, ref) {
  if (ref) {
    parent.insertBefore(el, ref);
  } else {
    parent.appendChild(el);
  }
}

function createChildren(vnode, children) {
  if (Array.isArray(children)) {
    for (let i = 0, length = children.length; i < length; i++) {
      createElm(children[i], vnode.elm);
    }
  }
}

function updateDOMListeners(vnode, oldVnode) {
  const data = vnode.data;
  const oldOn = oldVnode && oldVnode.data ? oldVnode.data.on : null;
  if (typeof data !== 'object' || data === null) {
    return;
  }
  addElmListeners(data.on, vnode, oldOn);
}

function addElmListeners(on, vnode, oldOn) {
  if (isUndef(on) || typeof on !== 'object') return;
  Object.keys(on).forEach(eventName => {
    if(!oldOn || !oldOn[eventName]) {
      vnode.elm.addEventListener(eventName, on[eventName].bind(vnode.context));
    }
  });
}

function updateAttributes(vnode) {
  const { attrs } = vnode.data
  if (isUndef(attrs) || typeof attrs !== 'object') return;
  Object.keys(attrs).forEach(key => {
    vnode.elm.setAttribute(key, attrs[key]);
  });
}

function updateStaticStyle(vnode) {
  const { staticStyle } = vnode.data;
  if (staticStyle && typeof staticStyle === 'object') {
    Object.keys(staticStyle).forEach(name => {
      vnode.elm.style[camelize(name)] = staticStyle[name];
    });
  }
}