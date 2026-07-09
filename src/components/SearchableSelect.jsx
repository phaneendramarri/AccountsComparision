import Select from 'react-select';

// Shared Tailwind + daisyUI class map for both single-select and multi-select
// wrappers. `unstyled` on react-select turns off its default styles so ours win.
const classNames = {
  control: ({ isFocused, isDisabled }) =>
    [
      'bg-base-100 border rounded-lg min-h-12 px-1 text-sm',
      isFocused ? 'border-primary ring-2 ring-primary/30' : 'border-base-300',
      isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
    ].join(' '),
  valueContainer: () => 'px-2 py-1 gap-1 flex flex-wrap',
  singleValue: () => 'text-base-content',
  placeholder: () => 'text-base-content/50',
  input: () => 'text-base-content',
  indicatorSeparator: () => 'bg-base-300',
  dropdownIndicator: () => 'text-base-content/60 px-2',
  clearIndicator: () => 'text-base-content/60 px-2 cursor-pointer',
  menu: () => 'mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg overflow-hidden z-30',
  menuList: () => 'py-1 max-h-64 overflow-auto',
  option: ({ isFocused, isSelected }) =>
    [
      'px-3 py-2 text-sm cursor-pointer',
      isSelected
        ? 'bg-primary text-primary-content'
        : isFocused
          ? 'bg-base-200 text-base-content'
          : 'text-base-content'
    ].join(' '),
  multiValue: () => 'bg-primary/15 rounded px-1 py-0.5 gap-1 items-center flex',
  multiValueLabel: () => 'text-primary text-xs font-medium',
  multiValueRemove: () =>
    'text-primary/70 hover:text-error hover:bg-error/10 rounded cursor-pointer px-1',
  noOptionsMessage: () => 'px-3 py-2 text-sm text-base-content/60'
};

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Search or select…',
  disabled = false,
  hint = ''
}) {
  const selected = value ? options.find((option) => option === value) : null;
  const optionObjects = options.map((option) => ({ value: option, label: option }));
  const selectedObject = selected ? { value: selected, label: selected } : null;

  return (
    <div className="form-control w-full">
      {label ? (
        <label className="label">
          <span className="label-text font-medium">{label}</span>
        </label>
      ) : null}
      <Select
        unstyled
        classNames={classNames}
        classNamePrefix="rs"
        options={optionObjects}
        value={selectedObject}
        onChange={(next) => onChange(next?.value ?? '')}
        placeholder={placeholder}
        isDisabled={disabled || options.length === 0}
        isClearable
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
      />
      {hint ? (
        <label className="label">
          <span className="label-text-alt text-base-content/60">{hint}</span>
        </label>
      ) : null}
    </div>
  );
}
