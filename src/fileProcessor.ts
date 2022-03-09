import * as fs from 'fs';
import * as temp from 'temp';
import * as espree from 'espree';
import { walk } from 'estree-walker';
import { generate } from 'astring';


export interface IProcessCallback {
  (path: string): void;
}

function insertBreaks(content: string): string {
  return content.split("\n").map((line,index) => `Debug.maybeBreak(${index}, ${JSON.stringify(line)});\n${line}`).join("\n");
}

function trackAssignments(content: string): string {
  // Here we'd like to track all assignments in the code, basically replace all assignments with a call to the debugger
  // e.g. var x = 123; becomes var x = Debug.assign("x",123);
  // New scopes are created for function declarations, where
  // e.g. function foo() { var x = 123; } becomes function foo() { try { Debug.pushScope(); var x = Debug.assign("x",123);  } finally { Debug.popScope(); } }
  try {
    const ast = espree.parse(content);
    console.debug(JSON.stringify(ast, null, 2));
    const newAst = walk(ast, {
      
      enter: function(node: any) {
        
        // "function foo() { var x = 123; }" becomes "function foo() { try { Debug.pushScope(); var x = Debug.assign("x",123);  } finally { Debug.popScope(); } }"
        if (node.type === 'FunctionDeclaration') {
          const newBody = {
            type: "BlockStatement",
            body: [
              {
                type: "TryStatement",
                block: {
                  type: "BlockStatement",
                  body: [
                    {
                      type: "ExpressionStatement",
                      expression: {
                        type: "CallExpression",
                        callee: {
                          type: "MemberExpression",
                          object: {
                            type: "Identifier",
                            name: "Debug"
                          },
                          property: {
                            type: "Identifier",
                            name: "pushScope"
                          },
                        },
                        arguments: []
                      }
                    },
                    ...node.body.body,
                  ]
                },
                finalizer: {
                  type: "BlockStatement",
                  body: [
                    {
                      type: "ExpressionStatement",
                      expression: {
                        type: "CallExpression",
                        callee: {
                          type: "MemberExpression",
                          object: {
                            type: "Identifier",
                            name: "Debug"
                          },
                          property: {
                            type: "Identifier",
                            name: "popScope"
                          },
                        },
                        "arguments": []
                      }
                    }
                  ]
                }
              }
            ]
          };
          
          this.replace({...node, body: newBody});
        }
        
        // "var x = 123;"" becomes "var x = Debug.declare("x",123);"
        if (node.type === "VariableDeclaration") {
          const declarations = node.declarations.map(declaration => {
            return {
              type: "VariableDeclarator",
              id: declaration.id,
              init: {
                type: "CallExpression",
                callee: {
                  type: "MemberExpression",
                  object: {
                    type: "Identifier",
                    name: "Debug"
                  },
                  property: {
                    type: "Identifier",
                    name: "declare"
                  },
                },
                arguments: [
                  {
                    type: "Literal",
                    value: declaration.id.name
                  },
                  declaration.init
                ]
              }
            };
            
            
          });
          
          this.replace({
            ...node,
            declarations: declarations
          });
        }
        
        
        // "x = 123;" becomes "x = Debug.assign("x",123);"
        if (node.type === 'AssignmentExpression') {
          const newNode = {
            ...node,
            right: {
              type: 'CallExpression',
              callee: {
                type: "MemberExpression",
                object: {
                  type: "Identifier",
                  name: "Debug"
                },
                property: {
                  type: "Identifier",
                  name: "assign"
                },
              },
              arguments: [
                {
                  type: 'Literal',
                  value: node.left.name
                },
                node.right
              ]
            }
          };
          this.replace(newNode);
        }
      }
    });
    
    //console.debug(JSON.stringify(newAst, null, 2));
    return generate(newAst);
  } catch (e) {
    console.error(e);
    return content;
  }
}

export function processFile(content: string, callback:IProcessCallback) {
  temp.track().open("flow", (err, info) => {
    if (!err) {
      fs.writeFile(info.fd, trackAssignments(insertBreaks(content)), (err) => {
        callback(info.path);
      });
    } else {
      callback(err);
      console.error(err);
    }
  });
}

/*fs.readFile("./ast.js", (err, data) => {
  if (!err) {
    processFile(data.toString(), (path) => {
      console.log(path);
      fs.readFile(path, (err, data) => {
        console.log(data.toString());
      });
    });
  }
});*/