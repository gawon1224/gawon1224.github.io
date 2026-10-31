<h2 id="publications">Publications</h2>

<div class="publications">
{% for link in site.data.publications.main %}
<article class="pub">
  {% if link.anim %}
  <canvas class="teaser pub-anim" data-anim="{{ link.anim }}" role="img" tabindex="0"></canvas>
  {% if link.image %}<noscript><img src="{{ link.image }}" class="teaser" alt="" loading="lazy"></noscript>{% endif %}
  {% elsif link.image %}
  <img src="{{ link.image }}" class="teaser" alt="" loading="lazy">
  {% endif %}
  <div class="pub-body">
    <div class="title">{% if link.pdf %}<a href="{{ link.pdf }}">{{ link.title }}</a>{% else %}{{ link.title }}{% endif %}</div>
    <div class="author">{{ link.authors }}</div>
    <div class="links">
      {% if link.conference_short %}<span class="venue">{{ link.conference_short }}</span>{% endif %}
      {% if link.pdf %}<a href="{{ link.pdf }}" target="_blank" rel="noopener">Paper</a>{% endif %}
      {% if link.arxiv %}<a href="{{ link.arxiv }}" target="_blank" rel="noopener">arXiv</a>{% endif %}
      {% if link.code %}<a href="{{ link.code }}" target="_blank" rel="noopener">Code</a>{% endif %}
      {% if link.page %}<a href="{{ link.page }}" target="_blank" rel="noopener">Project Page</a>{% endif %}
      {% if link.bibtex %}<a href="{{ link.bibtex }}" target="_blank" rel="noopener">BibTeX</a>{% endif %}
      {% if link.notes %}<span class="notes">{{ link.notes }}</span>{% endif %}
      {% if link.others %}{{ link.others }}{% endif %}
    </div>
  </div>
</article>
{% endfor %}
</div>
