import { useEffect, useState } from "react";

export default function EncuestasPage() {

  const [questions, setQuestions] = useState<any[]>([]);
  const [current, setCurrent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    const res = await fetch("/api/mantenedor-encuestas");
    const data = await res.json();
    setQuestions(data.questions || []);
    setLoading(false);
  }

  /* ================= ACCIONES ================= */

  function addQuestion() {
    setCurrent({
      id: crypto.randomUUID(),
      text: "",
      type: "rating",
      options: []
    });
  }

  async function saveQuestion() {

    if (!current?.text) {
      alert("Ingrese texto de la pregunta");
      return;
    }

    if (
      current?.type === "single_choice" &&
      (!current?.options || !current.options.length)
    ) {
      alert("Agregue al menos una opción");
      return;
    }

    setSaving(true);

    const updated = [...questions, current];

    await fetch("/api/encuestas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: updated })
    });

    setQuestions(updated);
    setCurrent(null);
    setSaving(false);
  }

  async function deleteQuestion(id: string) {

    if (!confirm("¿Eliminar pregunta?")) return;

    await fetch("/api/encuestas", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });

    setQuestions(questions.filter(q => q.id !== id));
  }

  /* ================= OPCIONES ================= */

  function addOption() {
    if (!current) return;

    setCurrent({
      ...current,
      options: [
        ...(current.options || []),
        { id: crypto.randomUUID(), text: "" }
      ]
    });
  }

  function updateOption(index: number, value: string) {
    if (!current) return;

    const copy = [...(current.options || [])];
    copy[index].text = value;

    setCurrent({ ...current, options: copy });
  }

  function removeOption(index: number) {
    if (!current) return;

    const copy = [...(current.options || [])];
    copy.splice(index, 1);

    setCurrent({ ...current, options: copy });
  }

  /* ================= UTILS ================= */

  function labelType(type: string) {
    if (type === "rating") return "Estrellas";
    if (type === "single_choice") return "Opción única";
    if (type === "text") return "Texto libre";
    return type;
  }

  /* ================= UI ================= */


  return (
    <div style={{ padding: 20 }}>

      <s-page heading="Mantenedor de Encuestas"></s-page>

      {!current && (
        <s-button variant="primary" onClick={addQuestion}>
          ➕ Agregar pregunta
        </s-button>
      )}

      <br></br>

      {/* FORM */}
      {current && (
        <div style={{
          background: "white",
          border: "1px solid #ddd",
          padding: 20,
          borderRadius: 12,
          marginTop: 20
        }}>

          <s-text-field
            label="Texto pregunta"
            value={current?.text || ""}
            placeholder="Ej: ¿Cómo fue tu experiencia?"
            onInput={(e: any) =>
              setCurrent({ ...current, text: e.target.value })
            }
          />

          <br />

          <s-select
            label="Tipo"
            value={current?.type || "rating"}
            onChange={(e: any) =>
              setCurrent({
                ...current,
                type: e.target.value,
                options: []
              })
            }
          >
            <s-option value="rating">Estrellas</s-option>
            <s-option value="single_choice">Opción única</s-option>
            <s-option value="text">Texto libre</s-option>
          </s-select>

          {/* OPCIONES */}
          {current?.type === "single_choice" && (
            <>
              <br />
              <strong>Opciones</strong>

              {current?.options?.map((o: any, i: number) => (
                <div
                  key={o.id}
                  style={{ display: "flex", gap: 10, marginTop: 10 }}
                >

                  <s-text-field
                    placeholder={`Opción ${i + 1}`}
                    value={o.text}
                    onInput={(e: any) =>
                      updateOption(i, e.target.value)
                    }
                  />

                  <s-button
        
                    size="slim"
                    onClick={() => removeOption(i)}
                  >
                    ✖
                  </s-button>

                </div>
              ))}

              <br />

              <s-button

                onClick={addOption}
              >
                ➕ Agregar opción
              </s-button>
            </>
          )}

          <br /><br />

          <div style={{ display: "flex", gap: 10 }}>
            <s-button
              variant="primary"
              loading={saving}
              onClick={saveQuestion}
            >
               Guardar
            </s-button>

            <s-button
              variant="secondary"
              onClick={() => setCurrent(null)}
            >
              Cancelar
            </s-button>
          </div>

        </div>
      )}

      {/* TABLA */}
      <br />

      <s-section padding="none">
        <s-table>

          <s-table-header-row>
            <s-table-header>Pregunta</s-table-header>
            <s-table-header>Tipo</s-table-header>
            <s-table-header>Acciones</s-table-header>
          </s-table-header-row>

          <s-table-body>

            {questions.map(q => {
              if (!q) return null;

              const isOpen = expandedId === q.id;

              return (
                <>
                  <s-table-row key={q.id}>

                    <s-table-cell>

                      {q.type === "single_choice" && (
                        <s-button
            
                          variant="tertiary"
                          onClick={() =>
                            setExpandedId(isOpen ? null : q.id)
                          }
                        >
                          {isOpen ? "▼" : "▶"}
                        </s-button>
                      )}

                      &nbsp; {q.text || "-"}

                    </s-table-cell>

                    <s-table-cell>
                      {labelType(q.type)}
                    </s-table-cell>

                    <s-table-cell>
                      <s-button
                        variant="secondary"
                        onClick={() => deleteQuestion(q.id)}
                      >
                        Eliminar
                      </s-button>
                    </s-table-cell>

                  </s-table-row>

     
                  {isOpen && q.type === "single_choice" && (
                    <s-table-row>

                      <s-table-cell >

                        <div> 

                          <strong>Opciones:</strong>

                          <ul style={{ marginTop: 8 }}>
                            {q.options?.map((o: any) => (
                              <li key={o.id}>
                                {o.text}
                              </li>
                            ))}
                          </ul>

                        </div>

                      </s-table-cell>

                    </s-table-row>
                  )}
                </>
              );
            })}

            {!questions.length && (
              <s-table-row>
                <s-table-cell>Sin preguntas aún</s-table-cell>
                <s-table-cell></s-table-cell>
                <s-table-cell></s-table-cell>
              </s-table-row>
            )}

          </s-table-body>

        </s-table>
      </s-section>

    </div>
  );
}
