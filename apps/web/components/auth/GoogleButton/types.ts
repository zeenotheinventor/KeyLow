export type GoogleButtonProps = {
  /** True while this button's own request runs. It shows a spinner. */
  loading: boolean;
  /** Holds the button back, such as while another request runs or the Terms are not ticked. */
  disabled: boolean;
  onClick: () => void;
};
