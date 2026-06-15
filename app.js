const ACCESS_CODE = "chunzhi";
const SESSION_KEY = "chunzhi-vault:unlocked";
const config = window.CHUNZHI_VAULT_CONFIG || {};
const hasSupabaseConfig = Boolean(config.supabaseUrl && config.supabaseAnonKey);

const state = {
  unlocked: localStorage.getItem(SESSION_KEY) === "yes",
  items: [],
  selectedId: null,
  search: "",
  category: "",
};

const els = {
  gateView: document.querySelector("#gateView"),
  vaultView: document.querySelector("#vaultView"),
  gateForm: document.querySelector("#gateForm"),
  passcodeInput: document.querySelector("#passcodeInput"),
  gateMessage: document.querySelector("#gateMessage"),
  lockButton: document.querySelector("#lockButton"),
  statusText: document.querySelector("#statusText"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  newItemButton: document.querySelector("#newItemButton"),
  itemList: document.querySelector("#itemList"),
  detailPanel: document.querySelector("#detailPanel"),
  itemDialog: document.querySelector("#itemDialog"),
  itemForm: document.querySelector("#itemForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
  cancelButton: document.querySelector("#cancelButton"),
  itemIdInput: document.querySelector("#itemIdInput"),
  titleInput: document.querySelector("#titleInput"),
  categoryInput: document.querySelector("#categoryInput"),
  tagsInput: document.querySelector("#tagsInput"),
  sourceUrlInput: document.querySelector("#sourceUrlInput"),
  contentInput: document.querySelector("#contentInput"),
  toast: document.querySelector("#toast"),
};

init();

function init() {
  bindEvents();
  renderGate();
  if (state.unlocked) {
    void loadItems();
  }
}

function bindEvents() {
  els.gateForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = els.passcodeInput.value.trim();
    if (code !== ACCESS_CODE) {
      els.gateMessage.textContent = "口令不正确。";
      els.gateMessage.hidden = false;
      return;
    }
    localStorage.setItem(SESSION_KEY, "yes");
    state.unlocked = true;
    els.passcodeInput.value = "";
    els.gateMessage.hidden = true;
    renderGate();
    void loadItems();
  });

  els.lockButton.addEventListener("click", () => {
    localStorage.removeItem(SESSION_KEY);
    state.unlocked = false;
    state.items = [];
    state.selectedId = null;
    renderGate();
  });

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    renderItems();
  });

  els.categoryFilter.addEventListener("change", () => {
    state.category = els.categoryFilter.value;
    renderItems();
  });

  els.newItemButton.addEventListener("click", () => openItemDialog());
  els.itemForm.addEventListener("submit", handleSaveItem);
  els.closeDialogButton.addEventListener("click", closeDialog);
  els.cancelButton.addEventListener("click", closeDialog);
}

function renderGate() {
  els.gateView.hidden = state.unlocked;
  els.vaultView.hidden = !state.unlocked;
  if (!state.unlocked) {
    window.setTimeout(() => els.passcodeInput.focus(), 0);
  }
}

async function loadItems() {
  if (!hasSupabaseConfig) {
    setStatus("未配置 Supabase", "error");
    showToast("请先填写 Supabase 配置。");
    return;
  }

  setStatus("同步中", "");
  try {
    state.items = await requestJson(
      `${apiBase()}/rest/v1/vault_items?select=id,title,category,content,tags,source_url,created_at,updated_at&order=updated_at.desc`,
      { headers: apiHeaders() }
    );
    setStatus("已连接 Supabase", "ok");
    renderCategoryOptions();
    renderItems();
    renderDetail(state.items.find((item) => item.id === state.selectedId) || null);
  } catch (error) {
    setStatus("连接失败", "error");
    showToast(error.message);
  }
}

async function handleSaveItem(event) {
  event.preventDefault();
  const id = els.itemIdInput.value;
  const payload = {
    title: els.titleInput.value.trim(),
    category: els.categoryInput.value.trim(),
    content: els.contentInput.value.trim(),
    tags: parseTags(els.tagsInput.value),
    source_url: els.sourceUrlInput.value.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (!payload.title || !payload.category || !payload.content) {
    showToast("请填写标题、分类和内容。");
    return;
  }

  try {
    const saved = id ? await updateItem(id, payload) : await createItem(payload);
    state.selectedId = saved?.id || id;
    closeDialog();
    await loadItems();
    showToast("保存成功。");
  } catch (error) {
    showToast(error.message);
  }
}

async function createItem(payload) {
  const data = await requestJson(`${apiBase()}/rest/v1/vault_items?select=id`, {
    method: "POST",
    headers: { ...apiHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return data?.[0] || null;
}

async function updateItem(id, payload) {
  const data = await requestJson(`${apiBase()}/rest/v1/vault_items?id=eq.${encodeURIComponent(id)}&select=id`, {
    method: "PATCH",
    headers: { ...apiHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return data?.[0] || null;
}

async function deleteItem(id) {
  if (!window.confirm("确定删除这条资料吗？")) return;
  try {
    await requestJson(`${apiBase()}/rest/v1/vault_items?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: apiHeaders(),
    });
    state.selectedId = null;
    await loadItems();
    showToast("已删除。");
  } catch (error) {
    showToast(error.message);
  }
}

function renderCategoryOptions() {
  const categories = [...new Set(state.items.map((item) => item.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-CN")
  );
  els.categoryFilter.innerHTML = `<option value="">全部分类</option>`;
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.categoryFilter.append(option);
  }
  els.categoryFilter.value = state.category;
}

function renderItems() {
  const items = getFilteredItems();
  els.itemList.innerHTML = "";

  if (!items.length) {
    els.itemList.innerHTML = `
      <div class="empty-state">
        <h2>没有资料</h2>
        <p>新增一条资料，或换个搜索词试试。</p>
      </div>
    `;
    return;
  }

  for (const item of items) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `item-card${item.id === state.selectedId ? " active" : ""}`;
    card.innerHTML = `
      <h3>${escapeHtml(item.title)}</h3>
      <div class="meta-row">
        <span class="chip">${escapeHtml(item.category || "未分类")}</span>
        <span class="chip">${formatDate(item.updated_at || item.created_at)}</span>
      </div>
      <p>${escapeHtml(item.content || "")}</p>
      ${renderTags(item.tags)}
    `;
    card.addEventListener("click", () => {
      state.selectedId = item.id;
      renderItems();
      renderDetail(item);
    });
    els.itemList.append(card);
  }
}

function renderDetail(item) {
  if (!item) {
    els.detailPanel.innerHTML = `
      <div class="empty-state">
        <h2>选择一条资料</h2>
        <p>点击左侧卡片查看详情，也可以新增你的第一条资料。</p>
      </div>
    `;
    return;
  }

  els.detailPanel.innerHTML = `
    <div class="detail-body">
      <div>
        <h2>${escapeHtml(item.title)}</h2>
        <div class="meta-row">
          <span class="chip">${escapeHtml(item.category || "未分类")}</span>
          <span class="chip">更新于 ${formatDate(item.updated_at || item.created_at)}</span>
        </div>
      </div>
      ${renderTags(item.tags)}
      <div class="detail-content">${escapeHtml(item.content || "")}</div>
      ${item.source_url ? `<a class="source-link" href="${escapeAttribute(item.source_url)}" target="_blank" rel="noreferrer">打开来源链接</a>` : ""}
      <div class="button-row">
        <button class="primary-button" id="editItemButton" type="button">编辑</button>
        <button class="secondary-button" id="deleteItemButton" type="button">删除</button>
      </div>
    </div>
  `;

  document.querySelector("#editItemButton").addEventListener("click", () => openItemDialog(item));
  document.querySelector("#deleteItemButton").addEventListener("click", () => deleteItem(item.id));
}

function openItemDialog(item = null) {
  els.dialogTitle.textContent = item ? "编辑资料" : "新增资料";
  els.itemIdInput.value = item?.id || "";
  els.titleInput.value = item?.title || "";
  els.categoryInput.value = item?.category || "";
  els.tagsInput.value = Array.isArray(item?.tags) ? item.tags.join(", ") : "";
  els.sourceUrlInput.value = item?.source_url || "";
  els.contentInput.value = item?.content || "";
  els.itemDialog.showModal();
  els.titleInput.focus();
}

function closeDialog() {
  els.itemDialog.close();
  els.itemForm.reset();
}

function getFilteredItems() {
  return state.items.filter((item) => {
    const tags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
    const searchable = `${item.title} ${item.category} ${item.content} ${tags}`.toLowerCase();
    const matchesSearch = !state.search || searchable.includes(state.search);
    const matchesCategory = !state.category || item.category === state.category;
    return matchesSearch && matchesCategory;
  });
}

function apiBase() {
  return config.supabaseUrl.replace(/\/$/, "");
}

function apiHeaders() {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    "Content-Type": "application/json",
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.hint || data?.details || `请求失败：${response.status}`);
  }
  return data;
}

function parseTags(value) {
  return value
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function renderTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return "";
  return `<div class="tag-row">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function setStatus(text, type) {
  els.statusText.textContent = text;
  els.statusText.className = `status-pill${type ? ` ${type}` : ""}`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 3200);
}

function formatDate(value) {
  if (!value) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
