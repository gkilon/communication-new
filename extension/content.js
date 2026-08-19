(function () {
  const PROCESSED_ATTR = 'data-kilon-processed';
  let panel = null;
  let colleaguesCache = null;
  let activeComposeBox = null;

  function findComposeBoxes() {
    // Gmail's compose body is a contenteditable div with role="textbox".
    return Array.from(document.querySelectorAll('div[role="textbox"][contenteditable="true"][aria-label]'))
      .filter(el => !el.hasAttribute(PROCESSED_ATTR));
  }

  function createButton(composeBox) {
    composeBox.setAttribute(PROCESSED_ATTR, 'true');

    const btn = document.createElement('button');
    btn.className = 'kilon-check-btn';
    btn.textContent = '✉️ בדיקת סגנון';
    btn.type = 'button';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      activeComposeBox = composeBox;
      openPanel();
    });

    // Insert the button right above the compose box
    composeBox.parentElement?.insertBefore(btn, composeBox);
  }

  function scanForComposeBoxes() {
    findComposeBoxes().forEach(createButton);
  }

  function ensurePanel() {
    if (panel) return panel;

    panel = document.createElement('div');
    panel.className = 'kilon-panel';
    panel.innerHTML = `
      <div class="kilon-panel-header">
        <span>בדיקת סגנון תקשורת</span>
        <button class="kilon-close-btn" type="button">✕</button>
      </div>
      <div class="kilon-panel-body">
        <label>הנמען (אופציונלי):</label>
        <select class="kilon-recipient-select">
          <option value="">לא ידוע / משוב כללי</option>
        </select>
        <button class="kilon-run-btn" type="button">בדוק/י עכשיו</button>
        <div class="kilon-result"></div>
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('.kilon-close-btn').addEventListener('click', () => {
      panel.classList.remove('kilon-panel-open');
    });

    panel.querySelector('.kilon-run-btn').addEventListener('click', runCheck);

    return panel;
  }

  function openPanel() {
    ensurePanel();
    panel.classList.add('kilon-panel-open');
    panel.querySelector('.kilon-result').innerHTML = '';
    loadColleagues();
  }

  function loadColleagues() {
    const select = panel.querySelector('.kilon-recipient-select');
    if (colleaguesCache) {
      populateSelect(select, colleaguesCache);
      return;
    }
    chrome.runtime.sendMessage({ type: 'GET_COLLEAGUES' }, (res) => {
      if (res?.ok) {
        colleaguesCache = res.colleagues;
        populateSelect(select, colleaguesCache);
      } else if (res?.error === 'NOT_LOGGED_IN') {
        panel.querySelector('.kilon-result').innerHTML =
          '<p class="kilon-error">יש להתחבר קודם דרך אייקון התוסף בסרגל הכלים.</p>';
      }
    });
  }

  function populateSelect(select, colleagues) {
    select.innerHTML = '<option value="">לא ידוע / משוב כללי</option>';
    colleagues.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.uid;
      opt.textContent = c.displayName;
      select.appendChild(opt);
    });
  }

  function runCheck() {
    if (!activeComposeBox) return;
    const draftText = activeComposeBox.innerText.trim();
    const resultEl = panel.querySelector('.kilon-result');

    if (!draftText) {
      resultEl.innerHTML = '<p class="kilon-error">הטיוטה ריקה.</p>';
      return;
    }

    const recipientUid = panel.querySelector('.kilon-recipient-select').value;
    resultEl.innerHTML = '<p class="kilon-loading">בודק...</p>';

    chrome.runtime.sendMessage(
      { type: 'CHECK_EMAIL_STYLE', draftText, recipientUid },
      (res) => {
        if (res?.ok) {
          renderFeedback(resultEl, res.feedback);
        } else if (res?.error === 'NOT_LOGGED_IN') {
          resultEl.innerHTML = '<p class="kilon-error">יש להתחבר קודם דרך אייקון התוסף בסרגל הכלים.</p>';
        } else {
          resultEl.innerHTML = `<p class="kilon-error">${res?.error || 'שגיאה'}</p>`;
        }
      }
    );
  }

  function renderFeedback(resultEl, feedback) {
    resultEl.innerHTML = '';

    const insightEl = document.createElement('p');
    insightEl.className = 'kilon-insight';
    insightEl.textContent = feedback.insight;
    resultEl.appendChild(insightEl);

    if (feedback.originalSentence) {
      const origEl = document.createElement('p');
      origEl.className = 'kilon-original';
      origEl.textContent = `במקום: "${feedback.originalSentence}"`;
      resultEl.appendChild(origEl);
    }

    (feedback.alternatives || []).forEach(alt => {
      const row = document.createElement('div');
      row.className = 'kilon-alt-row';

      const labelEl = document.createElement('span');
      labelEl.className = 'kilon-alt-label';
      labelEl.textContent = alt.label;

      const textEl = document.createElement('span');
      textEl.className = 'kilon-alt-text';
      textEl.textContent = alt.text;

      const copyBtn = document.createElement('button');
      copyBtn.className = 'kilon-copy-btn';
      copyBtn.type = 'button';
      copyBtn.textContent = 'העתק';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(alt.text).then(() => {
          copyBtn.textContent = 'הועתק! ✓';
          setTimeout(() => { copyBtn.textContent = 'העתק'; }, 1500);
        });
      });

      row.appendChild(labelEl);
      row.appendChild(textEl);
      row.appendChild(copyBtn);
      resultEl.appendChild(row);
    });
  }

  // Gmail is a single-page app that mounts compose windows dynamically —
  // poll periodically rather than relying on one-time DOM ready.
  setInterval(scanForComposeBoxes, 1500);
  scanForComposeBoxes();
})();
