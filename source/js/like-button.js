(function () {
  const CLIENT_ID_KEY = 'blog_like_client_id';
  const buttons = Array.from(document.querySelectorAll('.post-like'));

  if (!buttons.length) {
    return;
  }

  function getClientId() {
    try {
      const saved = localStorage.getItem(CLIENT_ID_KEY);
      if (saved) {
        return saved;
      }

      const generated = window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(CLIENT_ID_KEY, generated);
      return generated;
    } catch (error) {
      return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }

  const clientId = getClientId();
  const groups = new Map();

  buttons.forEach((container) => {
    const postId = container.dataset.postId;
    const apiBaseUrl = container.dataset.apiBaseUrl;

    if (!postId || !apiBaseUrl) {
      return;
    }

    const key = `${apiBaseUrl}|${postId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        postId,
        apiBaseUrl,
        containers: [],
        loading: false,
        liked: false,
        disabled: false,
        likeCount: 0,
        message: ''
      });
    }

    groups.get(key).containers.push(container);
  });

  function endpoint(group, suffix) {
    return `${group.apiBaseUrl}/posts/${encodeURIComponent(group.postId)}/${suffix}`;
  }

  async function requestJson(url, options) {
    const response = await fetch(url, {
      mode: 'cors',
      ...options,
      headers: {
        Accept: 'application/json',
        'X-Client-ID': clientId,
        ...(options && options.headers ? options.headers : {})
      }
    });

    if (!response.ok) {
      const error = new Error(`Like API request failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  function render(group) {
    group.containers.forEach((container) => {
      const button = container.querySelector('.post-like-button');
      const icon = container.querySelector('.post-like-button i');
      const label = container.querySelector('.post-like-label');
      const count = container.querySelector('.post-like-count');
      const message = container.querySelector('.post-like-message');

      container.classList.toggle('is-loading', group.loading);
      container.classList.toggle('is-liked', group.liked);
      container.classList.toggle('is-disabled', group.disabled && !group.liked);
      container.classList.toggle('has-message', Boolean(group.message));

      if (button) {
        button.disabled = group.loading || group.liked || group.disabled;
        button.setAttribute('aria-pressed', String(group.liked));
      }

      if (icon) {
        icon.className = group.liked ? 'fas fa-heart' : 'far fa-heart';
      }

      if (label) {
        label.textContent = group.liked ? 'いいね済み' : group.disabled ? '利用できません' : 'いいね';
      }

      if (count) {
        count.textContent = String(group.likeCount);
      }

      if (message) {
        message.textContent = group.message;
      }
    });
  }

  function setState(group, state) {
    Object.assign(group, state);
    render(group);
  }

  async function refreshLiked(group, message) {
    const result = await requestJson(endpoint(group, 'liked'));
    setState(group, {
      liked: Boolean(result.liked),
      likeCount: Number(result.like_count || 0),
      message: message || ''
    });
  }

  async function initialize(group) {
    setState(group, { loading: true, message: '読み込み中...' });

    try {
      await refreshLiked(group);
      setState(group, { loading: false });
    } catch (error) {
      const message = error.status === 429
        ? '時間を置いて再表示してください'
        : 'いいね数を取得できませんでした';
      setState(group, { loading: false, disabled: true, message });
    }
  }

  async function addLike(group) {
    if (group.loading || group.liked) {
      return;
    }

    setState(group, { loading: true, message: '送信中...' });

    try {
      const result = await requestJson(endpoint(group, 'like'), { method: 'POST' });

      if (result.liked) {
        setState(group, {
          loading: false,
          liked: true,
          likeCount: Number(result.like_count || group.likeCount),
          message: 'ありがとうございます'
        });
        return;
      }

      await refreshLiked(group);
      setState(group, {
        loading: false,
        message: group.liked ? 'すでにいいね済みです' : '今日はもう押せません'
      });
    } catch (error) {
      const message = error.status === 429
        ? 'しばらく待ってからお試しください'
        : '送信できませんでした';
      setState(group, { loading: false, message });
    }
  }

  groups.forEach((group) => {
    group.containers.forEach((container) => {
      const button = container.querySelector('.post-like-button');
      if (button) {
        button.addEventListener('click', () => addLike(group));
      }
    });

    initialize(group);
  });
}());
