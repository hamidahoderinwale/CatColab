import { DocHandle } from "@automerge/automerge-repo";
import { createEffect, createMemo, createSignal, For, Match, Switch } from "solid-js";

import { IndexedMap, indexMap } from "../util/indexed_map";
import { useDoc } from "../util/automerge_solid";

import { isoTheoryId, TheoryId, TheoryMeta } from "../theory";
import { ModelJudgment, MorphismDecl, newMorphismDecl, newObjectDecl, NotebookModel, ObjectDecl, ObjectId } from "./types";
import { CellActions, CellConstructor, newFormalCell, newRichTextCell, NotebookEditor } from "../notebook";
import { InlineInput } from "../notebook/inline_input";
import { ObjectNameMapContext } from "./model_context";
import { ObjectCellEditor } from "./object_cell_editor";
import { MorphismCellEditor } from "./morphism_cell_editor";

import "./model_editor.css";


/** Editor for a cell in a model of a discrete double theory.
 */
export function ModelCellEditor(props: {
    content: ModelJudgment;
    changeContent: (f: (content: ModelJudgment) => void) => void;
    isActive: boolean;
    actions: CellActions;
}) {
    return (
        <Switch>
        <Match when={props.content.tag === "object"}>
            <ObjectCellEditor
                object={props.content as ObjectDecl}
                modifyObject={(f) => props.changeContent(
                    (content) => f(content as ObjectDecl)
                )}
                isActive={props.isActive} actions={props.actions}
            />
        </Match>
        <Match when={props.content.tag === "morphism"}>
            <MorphismCellEditor
                morphism={props.content as MorphismDecl}
                modifyMorphism={(f) => props.changeContent(
                    (content) => f(content as MorphismDecl)
                )}
                isActive={props.isActive} actions={props.actions}
            />
        </Match>
        </Switch>
    );
}

/** Notebook-based editor for a model of a discrete double theory.
 */
export function ModelEditor(props: {
    handle: DocHandle<NotebookModel>,
    init: NotebookModel,
    theories: TheoryMeta[],
}) {
    const [theory, setTheory] = createSignal<TheoryMeta | undefined>();

    const [model, changeModel] = useDoc(() => props.handle, props.init);

    createEffect(() => {
        const id = model().theory;
        for (const theory of props.theories) {
            if (id && id === theory.id) {
                setTheory(theory);
                return;
            }
        }
        setTheory(undefined);
    });

    const objectNameMap = createMemo<IndexedMap<ObjectId,string>>(() => {
        const map = new Map<ObjectId,string>();
        for (const cell of model().notebook.cells) {
            if (cell.tag == "formal" && cell.content.tag == "object") {
                map.set(cell.content.id, cell.content.name);
            }
        }
        return indexMap(map);
    });

    return (
        <div class="model">
            <div class="model-head">
                <div class="model-title">
                <InlineInput text={model().name}
                    setText={(text) => {
                        changeModel((model) => (model.name = text));
                    }}
                />
                </div>
                <div class="model-theory">
                <select required class="editable"
                    value={(id => id ? isoTheoryId.unwrap(id) : "")(model().theory)}
                    onInput={(evt) => {
                        let id = evt.target.value;
                        changeModel((model) => {
                            model.theory = id ? isoTheoryId.wrap(id) : undefined;
                        });
                    }}
                >
                    <option value="" disabled selected hidden>
                        Choose a logic
                    </option>
                    <For each={props.theories}>
                    {(theory) =>
                        <option value={isoTheoryId.unwrap(theory.id)}>
                            {theory.name}
                        </option>}
                    </For>
                </select>
                </div>
            </div>
            <ObjectNameMapContext.Provider value={objectNameMap}>
                <NotebookEditor handle={props.handle} path={["notebook"]}
                    notebook={model().notebook}
                    changeNotebook={(f) => {
                        changeModel((model) => f(model.notebook));
                    }}
                    formalCellEditor={ModelCellEditor}
                    cellConstructors={modelCellConstructors(theory())}
                />
            </ObjectNameMapContext.Provider>
        </div>
    );
}

type ModelCellConstructor = CellConstructor<ModelJudgment>;

function modelCellConstructors(theory?: TheoryMeta): ModelCellConstructor[] {
    // On Mac, the Alt/Option key remaps keys, whereas on other platforms
    // Control tends to be already bound in other shortcuts.
    const modifier = navigator.userAgent.includes("Mac") ? "Control" : "Alt";

    const result: ModelCellConstructor[] = [
        {
            name: "Text",
            shortcut: [modifier, "T"],
            construct: () => newRichTextCell(),
        }
    ];

    for (const typ of theory ? theory.types : []) {
        const {name, description, shortcut} = typ;
        result.push({
            name, description,
            shortcut: shortcut && [modifier, ...shortcut],
            construct: typ.tag === "ob_type" ?
                () => newFormalCell(newObjectDecl(typ.id)) :
                () => newFormalCell(newMorphismDecl(typ.id)),
        });
    }

    return result;
}
