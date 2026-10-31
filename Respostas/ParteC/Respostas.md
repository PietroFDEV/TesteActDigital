# Parte C --- Frontend (Angular 21 + Ionic)

## 14.

``` ts
import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';

@Component({
  selector: 'app-masked-value',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (field(); as f) {
      {{ shown() && f.raw ? f.raw : f.masked }}
      @if (f.raw) {
        <button type="button" aria-label="Mostrar valor completo"
                [attr.aria-pressed]="shown()" (click)="shown.set(!shown())">
          <span aria-hidden="true">👁</span>
        </button>
      }
    } @else {
      {{ empty() }}
    }
  `,
})
export class MaskedValueComponent {
  field = input<{ masked: string; raw?: string } | null>(null);
  empty = input('—');
  shown = linkedSignal({ source: this.field, computation: () => false });
}
```

Referência: [Angular --- Componentes](https://angular.dev/guide/components)

------------------------------------------------------------------------

## 15.

### a)

O problema pode ocorrer por utilizar `ionChange` no lugar de `ionInput`, `ionChange` é efetivado quando finaliza a ção já o `ionInput` é verificado durante a digitação.

Referência: [Ionic --- ion-textarea](https://ionicframework.com/docs/api/textarea)

### b)

O `setTimeout` agenda a atualização do valor para uma execução posterior, de forma assíncrona. Assim a busca pode ser executada
antes de o callback agendado atualizar o valor anterior, fazendo com que seja utilizado o valor antigo.

Remover o `setTimeout` e usar o `onChange()`, dentro do evento `ionInput`. Assim atualizaria na hora o valor.

Referência: [Angular --- Zone Pollution](https://angular.dev/best-practices/zone-pollution)

------------------------------------------------------------------------

## 16.

### a)

O `OnPush` verifica mudanças, o componente pai utiliza `push()` para adicionar um item ao
array original. Isso modifica o conteúdo, mas mantém a mesma referência do array. Por isso, o componente filho pode não detectar a alteração no input e não atualizar a lista.

### b)

``` ts
blocks = signal<Block[]>([]);

addBlock(block: Block): void {
  this.blocks.update(current => [...current, block]);
}
```

``` ts
export class BlockListComponent {
  blocks = input.required<Block[]>();

  totalBlocks = computed(() => this.blocks().length);
}
```

### c)

A substituição pelo ID faz sentido pois caso a lista seja modificada durante a execução, o index pode ficar com apontamentos incorretos.

Referência: [Angular --- Skipping component subtrees](https://angular.dev/best-practices/skipping-subtrees)

------------------------------------------------------------------------

## 17.

### a)

``` ts
import { CanDeactivateFn } from '@angular/router';
import { CockpitPage } from './cockpit.page';

export const canDeactivateCockpit: CanDeactivateFn<CockpitPage> =
  async (page) => {
    if (!page.store.hasOpenAttendance()) {
      return true;
    }

    const choice = await page.ask(
      'Existe um atendimento em andamento. O que deseja fazer?',
      [
        'Encerrar atendimento',
        'Sair e Cancelar atendimento',
        'Continuar no atendimento',
      ]
    );

    switch (choice) {
      case 0:
        page.openCloseAttendanceFlow();
        return false;

      case 1:
        await page.store.abandon();
        return true;

      case 2:
      case null:
      default:
        return false;
    }
  };
```

Referências: - [Angular --- CanDeactivate](https://angular.dev/guide/routing/route-guards#candeactivate) -
[Angular API --- CanDeactivate](https://angular.dev/api/router/CanDeactivate)

### b)

O `routerLink` e o `CanDeactivate` estiverem corretamente cadastrados na rota, o Angular Router executará a validação antes de permitir a navegação. Caso utilize `href` direto a navegação não terá nenhuma validação.


Referência: [Angular API --- Route](https://angular.dev/api/router/Route)

### c)

O `CanDeactivate` protege apenas as navegações controladas pelo Angular Router. Para casos de F5, Ctrl + R ou fechamento da aba,
utilizaria o evento `beforeunload` aonde o navegador exibe uma mensagem padrão de confirmação.


------------------------------------------------------------------------

## 18.

### a)

Utilizaria `switchMap` para cancelar a inscrição da pesquisa anterior quando o usuário digitar novamente, evitando que uma resposta antiga sobrescreva os resultados mais recentes.

Para aguardar os 400 ms após a última digitação, utilizaria o operador `debounceTime(400)`. 

``` ts
this.searchControl.valueChanges.pipe(
  debounceTime(400),
  switchMap(term => {
    if (term.trim().length < 3) {
      this.loading = false;
      this.error = null;
      this.results = [];
      return of([]);
    }

    this.loading = true;
    this.error = null;

    return this.api.search(term).pipe(
      catchError(() => {
        this.error = 'Não foi possível realizar a busca.';
        return of([]);
      }),
      finalize(() => {
        this.loading = false;
      })
    );
  })
).subscribe(results => {
  this.results = results;
});
```

Referências: - [RxJS --- switchMap](https://rxjs.dev/api/operators/switchMap) - [RxJS --- debounceTime](https://rxjs.dev/api/operators/debounceTime)

### b)

Para que a API seja chamada e possamos receber a resposta ou tratar o erro, é necessário realizar a inscrição no Observable retornado pelo `HttpClient`, utilizando `subscribe()`.

``` ts
api.call('/export/status', 'get', {}).subscribe({
  next: response => {
    console.log(response);
  },
  error: error => {
    console.error(error);
  }
});
```

Referência: [Angular --- Making HTTP requests](https://angular.dev/guide/http/making-requests)

------------------------------------------------------------------------

## 19.

O `bypassSecurityTrustHtml()` faz com que o Angular considere o HTML recebido confiável, ignorando a sanitização automática aplicada normalmente do `[innerHTML]`.
O conteúdo em `MD` pode ser utilizado de forma maliciosa com `HTML` com tags de `SCRIPT`, assim abrindo vulnerabilidades no código.

Referências: - [Angular API --- DomSanitizer](https://angular.dev/api/platform-browser/DomSanitizer#bypassSecurityTrustHtml)
